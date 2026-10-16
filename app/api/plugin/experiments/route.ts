import { authenticatedClient, ApiError } from '@/lib/server-access';
import { readJsonBody } from '@/lib/request-body';
import { openPluginDraft } from '@/lib/plugin-draft';
import { savePluginExperiment } from '@/lib/plugin-save';
import { canRecord } from '@/lib/permissions';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function POST(request: Request) {
  try {
    const { client, user } = await authenticatedClient(request);
    const body = await readJsonBody(request, 16000);
    if (body.action === 'save') {
      if (body.confirmed !== true) throw new ApiError('Revisa la ficha y confirma el guardado.', 400);
      return Response.json(await savePluginExperiment(client, user.id, body.token, body.project_id, body.google_non_political_confirmed === true), { headers });
    }
    if (body.action !== 'review') throw new ApiError('Acción no admitida.', 400);
    const draft = openPluginDraft(body.token);
    const membership = await client.from('members').select('workspace_id,role,permissions').eq('user_id', user.id);
    if (membership.error) throw new ApiError('No se pudieron consultar tus permisos.', 503);
    const workspaceIds = (membership.data || []).filter(m => canRecord(m, 'experiment', 'create') && (!draft.experiment.campaign || canRecord(m, 'experiment', 'edit'))).map(m => m.workspace_id);
    let projects: { id: string; title: string; workspace_id: string; workspace_name?: string }[] = [];
    if (workspaceIds.length) {
      const result = await client.from('records').select('id,title,workspace_id').eq('kind', 'project').in('workspace_id', workspaceIds).order('title').limit(201);
      if (result.error) throw new ApiError('No se pudieron consultar tus proyectos.', 503);
      if ((result.data || []).length > 200) throw new ApiError('Tienes más de 200 proyectos. Contacta con soporte para seleccionar el destino.', 400);
      const spaces = await client.from('workspaces').select('id,name').in('id', workspaceIds);
      if (spaces.error) throw new ApiError('No se pudieron consultar tus espacios.', 503);
      projects = (result.data || []).map(p => ({ ...p, workspace_name: spaces.data.find(w => w.id === p.workspace_id)?.name || '' }));
    }
    return Response.json({ experiment: draft.experiment, expires_at: new Date(draft.expires_at).toISOString(), projects }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : 'No se pudo procesar la ficha.' }, { status: error instanceof ApiError ? error.status : 500, headers });
  }
}
