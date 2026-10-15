import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {commonMethodology, methodologyInstructions} from '../lib/methodology-context';
import {methodologyBooks, methodologyBookForSource} from '../lib/methodology-library';
import {parseChat} from '../lib/ai-memory';
import {POST} from '../app/api/ai/chat/route';

test('shared catalog has attributed, compact syntheses, verified purchase editions and local covers', () => {
  const catalog = commonMethodology();
  assert.equal(catalog.scope, 'common');
  assert.equal(catalog.sources.length, 3);
  assert.ok(Buffer.byteLength(JSON.stringify(catalog)) < 14000, 'Common context remains bounded independently of private memory');
  assert.equal(new Set(catalog.sources.map(source => source.id)).size, 3);
  for (const book of methodologyBooks) {
    assert.ok(existsSync(`public${book.cover}`));
    assert.match(book.amazonUrl, /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}$/);
    const source = catalog.sources.find(source => source.id === `book:${book.id}`)!;
    assert.equal(source.project_id, null);
    assert.equal(source.kind, 'methodology_book');
    assert.equal(source.validation, 'methodological_reference');
    assert.match(source.excerpt, /Síntesis propia/);
    assert.equal(methodologyBookForSource(source.id)?.id, book.id);
  }
  assert.match(methodologyInstructions, /no es evidencia de mercado/);
  assert.match(methodologyInstructions, /No inventes citas literales/);
  assert.match(methodologyInstructions, /No añadas formularios obligatorios/);
});

test('book citations are allowlisted and common memory never accumulates team content', () => {
  const first = commonMethodology();
  const parsed = parseChat({answer: 'Investiga comportamientos recientes antes de validar la necesidad.', source_ids: ['book:the-mom-test', 'book:inventado', 'private-other-team'], proposal: null}, first.sources, false);
  assert.deepEqual(parsed.sources.map(source => source.id), ['book:the-mom-test']);
  first.sources[0].excerpt = 'PRIVATE_TEAM_DATA';
  assert.doesNotMatch(JSON.stringify(commonMethodology()), /PRIVATE_TEAM_DATA/);
  assert.equal(methodologyBookForSource('https://evil.test'), undefined);
  const client = readFileSync('app/methodology-library.tsx', 'utf8');
  assert.match(client, /<details/);
  assert.match(client, /loading="lazy"/);
  assert.doesNotMatch(client, /methodology-context/);
});

test('new and existing workspaces receive the same book context while private sources and conversations stay scoped', async () => {
  const env = {...process.env}, original = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://books.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test';
  process.env.OPENAI_API_KEY = 'sk-test-books';
  const user = '11111111-1111-4111-8111-111111111111';
  const spaces = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
  const seen: unknown[] = [];
  try {
    for (const [index, workspace] of spaces.entries()) {
      const json = (data: unknown) => Response.json(data);
      globalThis.fetch = async (input, options) => {
        const url = new URL(String(input)), path = url.pathname;
        if (path === '/auth/v1/user') return json({id: user});
        if (path.endsWith('/workspaces')) return json({id: workspace, name: `Team ${index}`});
        if (path.endsWith('/integration_connections')) return json({id: 'openai', enabled: true, source: 'environment', provider: 'openai', config: {}});
        if (path.endsWith('/rpc/can_record_action')) return json(false);
        if (path.endsWith('/rpc/reserve_ai_chat')) return json(0.03);
        if (path.endsWith('/rpc/search_workspace_memory')) {
          assert.equal(JSON.parse(String(options?.body)).w, workspace);
          return json({sources: index ? [{id: 'own-source', kind: 'import_text', title: 'Own note', excerpt: 'PRIVATE_TEAM_TWO', project_id: null, date: '2026-10-15'}] : [], coverage: {available: index}});
        }
        if (path.endsWith('/rpc/workspace_metric_facts')) return json([]);
        if (url.origin === 'https://api.openai.com') {
          const payload = JSON.parse(String(options?.body));
          const context = JSON.parse(payload.input[0].content[0].text.split('\n').slice(1).join('\n')).context;
          assert.equal(payload.store, false);
          assert.match(payload.instructions, /biblioteca methodology/);
          assert.equal(context.methodology.sources.length, 3);
          assert.equal(context.coverage.available, index);
          assert.equal(context.sources.length, index);
          assert.doesNotMatch(JSON.stringify(context.methodology), /PRIVATE_TEAM/);
          if (!index) assert.doesNotMatch(JSON.stringify(context), /PRIVATE_TEAM_TWO/);
          seen.push(context.methodology);
          return json({status: 'completed', output: [{content: [{type: 'output_text', text: JSON.stringify({answer: 'Pregunta por una situación reciente del cliente.', source_ids: ['book:the-mom-test', 'foreign-private-source'], proposal: null})}]}]});
        }
        if (path.endsWith('/ai_chat_entries') && options?.method === 'POST') {
          const entry = JSON.parse(String(options.body));
          assert.equal(entry.workspace_id, workspace);
          assert.equal(entry.user_id, user);
          return json({...entry, created_at: '2026-10-15'});
        }
        if (path.endsWith('/records') || path.endsWith('/ai_chat_entries')) {
          assert.equal(url.searchParams.get('workspace_id'), `eq.${workspace}`);
          if (path.endsWith('/ai_chat_entries')) assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
          return json([]);
        }
        throw new Error(`Unexpected endpoint ${path}`);
      };
      const response = await POST(new Request('https://app.test/api/ai/chat', {method: 'POST', headers: {Authorization: 'Bearer test', 'Content-Type': 'application/json'}, body: JSON.stringify({workspace_id: workspace, request_id: '44444444-4444-4444-8444-444444444444', question: '¿Cómo entrevisto a los primeros clientes?'})}));
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      assert.deepEqual(result.entry.sources.map((source: {id: string}) => source.id), ['book:the-mom-test']);
    }
    assert.deepEqual(seen[0], seen[1]);
  } finally { globalThis.fetch = original; process.env = env; }
});
