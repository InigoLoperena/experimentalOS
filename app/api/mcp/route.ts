import { pluginExperimentSchema } from '@/lib/plugin-experiment';
import { sealPluginDraft } from '@/lib/plugin-draft';
import { ApiError } from '@/lib/server-access';
import { readJsonBody } from '@/lib/request-body';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'X-Content-Type-Options': 'nosniff' };
const versions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const origins = new Set(['https://chatgpt.com', 'https://chat.openai.com', 'https://platform.openai.com', 'https://xperiments.site', 'https://www.xperiments.site']);
function allowed(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origins.has(origin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin));
}
const tool = {
  name: 'prepare_experiment_save', title: 'Preparar experimento para guardar en Experiments',
  description: 'Prepara una ficha y un enlace cifrado, válido 30 minutos, para revisarla y guardarla en Xperiments. No guarda todavía: el usuario abre el enlace, inicia sesión si hace falta, elige un proyecto y confirma. No lee proyectos ni recibe credenciales. No afirmes que se guardó al devolver el enlace. Usa solo cuando el usuario pida guardar/exportar una prueba; no envíes conversaciones enteras.',
  inputSchema: pluginExperimentSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  securitySchemes: [{ type: 'noauth' }],
  _meta: { 'openai/toolInvocation/invoking': 'Preparando la ficha…', 'openai/toolInvocation/invoked': 'Ficha lista para revisar y guardar' },
};
export async function POST(request: Request) {
  if (!allowed(request)) return new Response('Origin not allowed', { status: 403, headers });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return new Response('Use application/json', { status: 415, headers });
  const version = request.headers.get('mcp-protocol-version');
  if (version && !versions.includes(version)) return new Response('Unsupported MCP protocol version', { status: 400, headers });
  if (!(request.headers.get('accept') || '').includes('application/json')) return new Response('Accept application/json is required', { status: 406, headers });
  let id: string | number | null = null;
  const rpcError = (code: number, message: string, status = 200) => Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status, headers });
  try {
    const body = await readJsonBody(request, 20000);
    if (body.jsonrpc !== '2.0' || typeof body.method !== 'string' || (body.id !== undefined && typeof body.id !== 'string' && typeof body.id !== 'number')) return rpcError(-32600, 'Invalid request', 400);
    id = body.id ?? null;
    if (body.id === undefined) return new Response(null, { status: 202, headers });
    let result: unknown;
    if (body.method === 'initialize') result = { protocolVersion: versions.includes(body.params?.protocolVersion) ? body.params.protocolVersion : versions[0], capabilities: { tools: {} }, serverInfo: { name: 'xperiments-save', version: '1.4.0' }, instructions: 'Diseña experimentos y prepara su ficha para guardar en Xperiments. La única herramienta es prepare_experiment_save. El enlace NO confirma el guardado: el usuario debe abrirlo, elegir su proyecto y confirmar. Esta conexión prepara fichas nuevas; la consulta y gestión posterior se realizan en Xperiments con los permisos del usuario.' };
    else if (body.method === 'ping') result = {};
    else if (body.method === 'tools/list') result = { tools: [tool] };
    else if (body.method === 'tools/call') {
      if (body.params?.name !== tool.name) return rpcError(-32602, 'Unknown tool');
      try {
        const draft = sealPluginDraft(body.params.arguments);
        const output = { status: 'pending_confirmation', saved: false, save_url: `https://www.xperiments.site/plugins/validacion-de-negocios/guardar#draft=${draft.token}`, expires_at: draft.expires_at,
          message: 'Abre «Revisar y guardar», elige tu proyecto y confirma en Xperiments. La ficha todavía no está guardada. No compartas el enlace: contiene tu borrador cifrado.' };
        result = { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output };
      } catch (error) {
        result = { isError: true, content: [{ type: 'text', text: error instanceof ApiError && error.status === 503 ? error.message : error instanceof Error ? error.message : 'Revisa los datos del experimento.' }] };
      }
    } else return rpcError(-32601, 'Method not found');
    return Response.json({ jsonrpc: '2.0', id, result }, { headers });
  } catch (error) { return rpcError(-32700, error instanceof ApiError ? error.message : 'Invalid JSON', error instanceof ApiError ? error.status : 400); }
}
export async function GET(request: Request) { return new Response(null, { status: allowed(request) ? 405 : 403, headers: { ...headers, Allow: 'POST, OPTIONS' } }); }
export async function OPTIONS(request: Request) { return new Response(null, { status: allowed(request) ? 204 : 403, headers }); }
