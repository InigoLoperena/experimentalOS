import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonLd, publicMetadata, SITE_URL } from '../lib/public-site';
import { publicRss, publicSitemap, xmlText, type PublicPostSummary } from '../lib/public-discovery';
import robots from '../app/robots';
import { GET as llms } from '../app/llms.txt/route';
import { pluginMetadata } from '../app/plugins/validacion-de-negocios/plugin-info';

const now = Date.parse('2026-10-24T12:00:00Z');
const sample: PublicPostSummary = {
  slug: 'primer-experimento', title: 'Preguntas & evidencia <observada>', excerpt: 'Una hipótesis "mejor" no es un resultado. 🧪',
  status: 'published', published_at: '2026-10-23T12:00:00Z', updated_at: '2026-10-24T10:00:00Z',
};
const posts: PublicPostSummary[] = [
  sample,
  { ...sample, slug: 'borrador-privado', status: 'draft', title: 'No publicar' },
  { ...sample, slug: 'articulo-futuro', published_at: '2026-11-24T12:00:00Z' },
  { ...sample, slug: 'sin-fecha', published_at: null },
  { ...sample, slug: 'fecha-invalida', published_at: 'Not a date' },
  { ...sample, slug: '../ia/conversacion-privada' },
];

test('public metadata uses the serving host and a separate canonical for each document', () => {
  for (const path of ['/blog', '/guia-investigacion', '/privacy-policy']) {
    const data = publicMetadata({ title: 'Documento público', description: 'Descripción veraz', path });
    assert.equal(data.alternates?.canonical, `${SITE_URL}${path}`);
    assert.equal(data.openGraph?.url, `${SITE_URL}${path}`);
    assert.deepEqual(data.twitter?.images, [`${SITE_URL}/opengraph-image`]);
  }
  const plugin = pluginMetadata('Privacidad', 'Política específica', '/plugins/validacion-de-negocios/privacidad');
  assert.equal(plugin.alternates?.canonical, `${SITE_URL}/plugins/validacion-de-negocios/privacidad`);
  assert.throws(() => publicMetadata({ title: 'No', description: 'No', path: '//otro.example' }), /local absolute path/);
});

test('JSON-LD cannot terminate its script element through editorial text', () => {
  const data = { headline: '</script><script>alert(1)</script>', description: 'Línea\u2028separada\u2029también' };
  const serialized = jsonLd(data);
  assert.equal(serialized.includes('<'), false);
  assert.equal(serialized.includes('\u2028'), false);
  assert.deepEqual(JSON.parse(serialized), data);
});

test('sitemap includes public documents and eligible articles without workspace or draft data', () => {
  const data = publicSitemap(posts, now);
  const urls = data.map(item => item.url);
  assert.ok(urls.includes(`${SITE_URL}/`));
  assert.ok(urls.includes(`${SITE_URL}/agentes`));
  assert.ok(urls.includes(`${SITE_URL}/plugins/validacion-de-negocios/privacidad`));
  assert.ok(urls.includes(`${SITE_URL}/blog/primer-experimento`));
  assert.equal(urls.filter(url => /\/blog\//.test(url)).length, 1);
  assert.equal(urls.some(url => /borrador|futuro|sin-fecha|invalida|\/ia|\/api|\/equipo|\/integraciones|\/proyectos|administrar/.test(url)), false);
  assert.equal(publicSitemap().length, 9);
});

test('RSS escapes XML text and never exports drafts, future publications or raw private bodies', () => {
  const output = publicRss(posts, now);
  assert.match(output, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(output, /Preguntas &amp; evidencia &lt;observada&gt;/);
  assert.match(output, /&quot;mejor&quot;/);
  assert.match(output, /🧪/);
  assert.match(output, /<guid isPermaLink="true">https:\/\/www\.xperiments\.site\/blog\/primer-experimento<\/guid>/);
  assert.equal((output.match(/<item>/g) ?? []).length, 1);
  assert.doesNotMatch(output, /No publicar|borrador-privado|articulo-futuro|conversacion-privada/);
  assert.equal(xmlText('A\u0000\uD800B'), 'AB');
});

test('robots does not prevent crawlers from seeing noindex on application and editorial shells', () => {
  const data = robots();
  const rule = data.rules;
  assert.ok(!Array.isArray(rule));
  assert.equal(rule.userAgent, '*');
  assert.equal(rule.allow, '/');
  assert.deepEqual(rule.disallow, ['/api/']);
  for (const path of ['/proyectos', '/ia', '/blog/administrar', '/plugins/validacion-de-negocios/guardar']) assert.ok(!rule.disallow?.includes(path));
  assert.equal(data.sitemap, `${SITE_URL}/sitemap.xml`);
});

test('the public LLM document has a textual content type and disclaims access to private data', async () => {
  const response = llms();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/plain; charset=utf-8$/);
  const text = await response.text();
  assert.match(text, /\/producto\.md/);
  assert.match(text, /requieren autenticación y permisos/);
  assert.doesNotMatch(text, /api_key|access_token|service_role|libros\/.+\.pdf|13\/13|experiments\.example\.com/);
});
