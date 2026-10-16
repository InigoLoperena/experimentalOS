'use client';
import { useEffect, useState } from 'react';
import type { Item } from '@/lib/model';
import { supabase } from '@/lib/supabase';
import { addFileAttachment, loadAttachments } from '@/lib/attachment-service';
import { GoogleAdsPreparation } from '@/app/google-ads-preparation';
import { MetaCampaignBuilder } from '@/app/meta-campaign-builder';
import { SmartleadPreparation } from '@/app/smartlead-preparation';
import { pluginCampaignProviders } from '@/lib/plugin-campaign';

export function PluginCampaignDelivery({ experiment, editable }: { experiment: Item; editable: boolean }) {
  const channel = String(experiment.fields.channel) as keyof typeof pluginCampaignProviders;
  const [uploading, setUploading] = useState(false), [sending, setSending] = useState(false), [error, setError] = useState('');
  const [files, setFiles] = useState<string[]>([]), [revision, setRevision] = useState(0);
  const [checking, setChecking] = useState(false), [googleReview, setGoogleReview] = useState('');
  const [receipts, setReceipts] = useState<{ external_id: string | null; resource_type: string; label: string }[]>([]);
  async function refresh() {
    const result = await supabase!.from('external_resources').select('external_id,resource_type,label').eq('workspace_id', experiment.workspace_id).eq('project_id', experiment.project_id).eq('experiment_id', experiment.id).eq('provider', channel);
    if (result.error) throw new Error('No se pudieron comprobar los vínculos guardados. No repitas el envío sin revisar el proveedor.');
    setReceipts(result.data || []);
  }
  useEffect(() => {
    let live = true;
    void loadAttachments(experiment.id).then(rows => { if (live) setFiles(rows.map(r => r.name)); }).catch(() => { if (live) setError('No se pudieron consultar los materiales de la ficha.'); });
    void refresh().catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [experiment.id]);
  async function upload(selected: File[]) {
    if (uploading || sending || !editable) return;
    setUploading(true); setError('');
    try {
      for (const file of selected) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('En esta pantalla puedes adjuntar imágenes JPG, PNG o WebP.');
        await addFileAttachment(experiment.id, experiment.workspace_id, file);
        setFiles(previous => [...previous, file.name]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo adjuntar la imagen.'); }
    finally { setRevision(n => n + 1); setUploading(false); }
  }
  async function checkGoogle() {
    if (checking || uploading || sending || !editable) return;
    setChecking(true); setError(''); setGoogleReview('');
    try {
      const session = await supabase!.auth.getSession();
      if (!session.data.session) throw new Error('Inicia sesión para comprobar la propuesta.');
      const response = await fetch('/api/google-ads/prepare', { method: 'POST', headers: { Authorization: `Bearer ${session.data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'review', project_id: experiment.project_id, experiment_id: experiment.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Google no confirmó la validación.');
      setGoogleReview(`Google validó la propuesta sin crear recursos. Cuenta: ${result.account.name}; presupuesto diario ${result.recipe.daily} ${result.recipe.currency}. La creación sigue pendiente de tu confirmación.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo comprobar Google Ads.'); }
    finally { setChecking(false); }
  }
  return <section className="business-plugin-section business-plugin-callout" aria-label="Preparación de campaña vinculada">
    <h2>Preparar borrador en {pluginCampaignProviders[channel]}</h2>
    <p>La ficha ya está guardada. La campaña todavía necesita revisión y confirmación. Se utilizará la cuenta configurada para este equipo en <a href="/integraciones" target="_blank" rel="noopener noreferrer">Integraciones</a>.</p>
    <p>No se activarán anuncios ni se enviarán correos. Si el proveedor falla, tu ficha permanece guardada. No vuelvas a crear con otro conector una campaña ya enviada desde aquí.</p>
    {error && <p role="alert">{error}</p>}
    {channel !== 'smartlead' && <div><p>Meta y Google Display necesitan imágenes. Los nombres indicados en las variantes ayudan a asignarlas; revisa los recortes antes de confirmar. Adjuntarlas aquí no las envía todavía al proveedor.</p>
      <label htmlFor="plugin-campaign-images">Imágenes de las variantes</label><input id="plugin-campaign-images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!editable || uploading || sending} onChange={e => { const selected = Array.from(e.target.files || []); e.target.value = ''; void upload(selected); }} />
      {!!files.length && <ul>{files.map((name, i) => <li key={`${i}-${name}`}>{name}</li>)}</ul>}
      {uploading && <p role="status">Adjuntando materiales privados…</p>}
    </div>}
    {channel === 'google_ads' && <><p>Esta preparación crea una campaña con dos anuncios; Google optimiza su rotación. No equivale a un experimento A/B nativo con reparto aleatorio.</p><button type="button" className="btn" disabled={!editable || checking || uploading || sending} onClick={() => void checkGoogle()}>{checking ? 'Comprobando sin crear…' : 'Validar propuesta en Google sin crear'}</button>{googleReview && <p role="status">{googleReview}</p>}</>}
    {channel === 'meta_ads' && <p>Esta preparación crea recursos pausados con variantes. No configura por sí sola un test A/B nativo de Meta.</p>}
    <div key={revision}>
      {channel === 'google_ads' && <GoogleAdsPreparation experiment={experiment} editable={editable} locked={uploading || checking} onBusy={setSending} onSaved={refresh} />}
      {channel === 'meta_ads' && editable && <MetaCampaignBuilder experiment={experiment} locked={uploading} onBusy={setSending} onCreated={refresh} />}
      {channel === 'smartlead' && <SmartleadPreparation experiment={experiment} editable={editable} locked={uploading} onBusy={setSending} onSaved={refresh} />}
    </div>
    {!!receipts.length && <div><h3>Recursos vinculados a esta ficha</h3><p>Estos IDs constan en Experiments. En un envío parcial no significan que todos los pasos hayan terminado: consulta el estado de preparación.</p><ul>{receipts.map((r, i) => <li key={`${r.resource_type}-${r.external_id}-${i}`}>{r.label} · {r.resource_type} · {r.external_id}</li>)}</ul></div>}
    {!editable && <p>No tienes permiso para preparar campañas. La ficha guardada se conserva.</p>}
  </section>;
}
