import type { SupabaseClient } from '@supabase/supabase-js';

/** Save with the same account that reviewed the destination, even across tabs. */
export async function saveReviewedPluginExperiment(client: SupabaseClient, reviewedUserId: string, token: string, projectId: string, send: typeof fetch = fetch) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error('Inicia sesión para guardar el experimento.');
  if (data.session.user.id !== reviewedUserId) throw new Error('Has cambiado de cuenta. Vuelve a revisar la ficha y elige un proyecto de tu cuenta actual.');
  const response = await send('/api/plugin/experiments', {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ action: 'save', confirmed: true, token, project_id: projectId }),
  });
  const result = await response.json();
  if (!response.ok || result.saved !== true) throw new Error(result.error || 'No se ha confirmado el guardado.');
  return result;
}
