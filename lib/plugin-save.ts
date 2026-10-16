import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, authorizedProject } from './server-access';
import { canRecord } from './permissions';
import { openPluginDraft, pluginRecordId } from './plugin-draft';
import type { Item } from './model';

export async function savePluginExperiment(client: SupabaseClient, userId: string, token: unknown, projectId: unknown, googleNonPoliticalConfirmed = false) {
  if (typeof projectId !== 'string') throw new ApiError('Selecciona un proyecto.', 400);
  const draft = openPluginDraft(token);
  const project = await authorizedProject(client, projectId);
  const { data: member, error: memberError } = await client.from('members').select('role,permissions')
    .eq('workspace_id', project.workspace_id).eq('user_id', userId).single();
  if (memberError || !canRecord(member, 'experiment', 'create')) throw new ApiError('No tienes permiso para crear experimentos en este proyecto.', 403);
  const id = pluginRecordId(draft.id, userId);
  const existing = async () => {
    const { data, error } = await client.from('records').select('*').eq('id', id).maybeSingle();
    if (error) throw new ApiError('No se pudo comprobar el guardado. Vuelve a intentarlo.', 503);
    if (data && (data.project_id !== project.id || data.created_by !== userId || data.kind !== 'experiment')) throw new ApiError('Esta ficha ya se guardó en otro proyecto. No se ha duplicado.', 409);
    return data;
  };
  let record = await existing();
  let alreadySaved = Boolean(record);
  if (!record) {
    const { title, campaign, ...fields } = draft.experiment;
    if (campaign && !canRecord(member, 'experiment', 'edit')) throw new ApiError('Para preparar una campaña necesitas también permiso para editar experimentos.', 403);
    let preparedFields: Item['fields'] = fields;
    if (campaign) {
      const plan = structuredClone(campaign.plan);
      if (campaign.provider === 'google_ads' && googleNonPoliticalConfirmed) plan.google!.eu_political = false;
      preparedFields = { ...fields, channel: campaign.provider, execution_config: JSON.stringify(plan) };
    }
    const payload = { id, workspace_id: project.workspace_id, project_id: project.id,
      kind: 'experiment', title, fields: preparedFields, owner_id: userId, parent_id: null, related_id: null };
    // The existing atomic RPC writes the record, budget/spec and both variants together.
    const result = campaign
      ? await client.rpc('save_experiment_preparation', { p_record: payload, p_expected: null }).then(r => ({ ...r, data: Array.isArray(r.data) ? r.data[0] : null }))
      : await client.from('records').insert(payload).select('*').single();
    if (result.error?.code === '23505') { record = await existing(); alreadySaved = true; }
    else if (result.error) throw new ApiError('No se pudo guardar. Revisa tus permisos y vuelve a intentarlo.', result.error.code === '42501' ? 403 : 503);
    else record = result.data;
    if (!record) throw new ApiError('No se ha podido confirmar el guardado. Vuelve a intentarlo.', 503);
  }
  return { saved: true, already_saved: alreadySaved, record_id: record.id, title: record.title, project_name: project.title,
    ...(draft.experiment.campaign ? { experiment: record as Item, can_prepare: canRecord(member, 'experiment', 'edit'), campaign_saved: false } : {}),
    url: '/experimentos', message: alreadySaved ? 'Este experimento ya estaba guardado; no se ha duplicado.' : 'Experimento guardado en tu proyecto.' };
}
