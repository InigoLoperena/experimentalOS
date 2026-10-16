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
const campaignTool = {
  ...tool,
  name: 'prepare_campaign_experiment', title: 'Preparar ficha y borrador de campaña',
  description: 'Prepara en un mismo enlace la ficha de experimento y dos variantes para Google Ads (Búsqueda/Display), Meta Ads (Facebook/Instagram) o Smartlead (correo). El usuario guarda la ficha y confirma la creación del borrador en Xperiments usando sus conexiones privadas. Nada se envía al proveedor desde esta herramienta pública. Los anuncios quedan pausados y Smartlead sin enviar. No solicites claves ni IDs de cuenta. Si otro conector ya creó la campaña, no uses esta herramienta para volver a crearla. Un borrador con variantes no equivale a un A/B nativo ni modifica código.',
  inputSchema: { ...pluginExperimentSchema, required: [...pluginExperimentSchema.required, 'campaign'] },
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
    if (body.method === 'initialize') result = { protocolVersion: versions.includes(body.params?.protocolVersion) ? body.params.protocolVersion : versions[0], capabilities: { tools: {} }, serverInfo: { name: 'xperiments-save', version: '1.2.0' }, instructions: 'Prepara fichas y borradores para revisión en Xperiments. El enlace NO confirma un guardado ni una campaña: el usuario debe abrirlo y confirmar en su cuenta. No dupliques campañas creadas por otro conector.' };
    else if (body.method === 'ping') result = {};
    else if (body.method === 'tools/list') result = { tools: [tool, campaignTool] };
    else if (body.method === 'tools/call') {
      if (![tool.name, campaignTool.name].includes(body.params?.name)) return rpcError(-32602, 'Unknown tool');
      try {
        if (body.params.name === campaignTool.name && !body.params.arguments?.campaign) throw new Error('Falta la campaña que quieres preparar.');
        const draft = sealPluginDraft(body.params.arguments);
        const output = { status: 'pending_confirmation', saved: false, save_url: `https://www.xperiments.site/plugins/validacion-de-negocios/guardar#draft=${draft.token}`, expires_at: draft.expires_at,
          ...(body.params.arguments?.campaign ? { campaign_saved: false, provider: body.params.arguments.campaign.provider } : {}),
          message: 'Abre «Revisar y guardar», elige tu proyecto y confirma en Experiments. La ficha todavía no está guardada. Si incluye campaña, revísala y confirma su envío por separado: quedará pausada o en borrador. No compartas el enlace: contiene tu borrador cifrado.' };
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
