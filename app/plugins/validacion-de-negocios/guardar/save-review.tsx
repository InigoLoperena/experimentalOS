'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { PluginExperiment } from '@/lib/plugin-experiment';
import { saveReviewedPluginExperiment } from '@/lib/plugin-review-client';

type Review = { experiment: PluginExperiment; expires_at: string; projects: { id: string; title: string; workspace_name: string }[] };
type Saved = { saved: boolean; title: string; project_name: string; message: string;  };
const labels: Partial<Record<keyof PluginExperiment, string>> = { context: 'Contexto', hypothesis: 'Hipótesis', metric: 'Métrica principal', success_criteria: 'Criterio de éxito', start: 'Fecha de inicio', tags: 'Etiquetas', impact: 'Impacto', confidence: 'Confianza', ease: 'Facilidad' };
export function SaveExperimentReview() {
  const [session, setSession] = useState<Session | null>(null), [checked, setChecked] = useState(false);
  const [token, setToken] = useState(''), [review, setReview] = useState<Review | null>(null), [project, setProject] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState<Saved | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('draft') || '');
    if (!supabase) { setChecked(true); return; }
    let live = true;
    void supabase.auth.getSession().then(({ data }) => { if (live) { setSession(data.session); setChecked(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (live) { setSession(next); setChecked(true); } });
    const refresh = () => { void supabase!.auth.getSession().then(({ data }) => { if (live) setSession(data.session); }); };
    window.addEventListener('focus', refresh);
    return () => { live = false; data.subscription.unsubscribe(); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    setReview(null); setProject(''); setSaved(null); setError('');
    if (!session || !token) return;
    const abort = new AbortController(); setBusy(true);
    void (async () => {
      try {
        const response = await fetch('/api/plugin/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'review', token }), signal: abort.signal, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'No se pudo recuperar la ficha.');
        if (!abort.signal.aborted) { setReview(body); if (body.projects.length === 1) setProject(body.projects[0].id); }
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo recuperar la ficha.'); }
      finally { if (!abort.signal.aborted) setBusy(false); }
    })();
    return () => abort.abort();
  }, [session?.access_token, token, retry]);
  async function save() {
    if (!session || !review || !project || busy || saved) return;
    setBusy(true); setError('');
    try {
      const result = await saveReviewedPluginExperiment(supabase!, session.user.id, token, project);
      setSaved(result); window.history.replaceState(null, '', window.location.pathname);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Puedes volver a intentarlo sin duplicar la ficha.'); }
    finally { setBusy(false); }
  }
  if (!checked) return <p role="status">Comprobando tu sesión…</p>;
  if (!supabase) return <p role="alert">El acceso a Experiments todavía no está configurado.</p>;
  if (!token) return <p role="alert">Falta el enlace de la ficha. Pide al complemento «prepara este experimento para guardarlo en Experiments» y abre el enlace completo que te devuelva.</p>;
  if (!session) return <section className="business-plugin-section"><h2>Accede a tu cuenta</h2><p>Inicia sesión en Experiments en otra pestaña y vuelve aquí. Este enlace caduca a los 30 minutos. No compartas el enlace: da acceso al borrador, aunque cada persona solo puede guardarlo en sus propios proyectos.</p><a className="btn primary" href="/" target="_blank" rel="noopener noreferrer">Abrir Experiments e iniciar sesión</a><p>Si todavía no tienes cuenta, regístrate en Experiments y crea un proyecto en tu espacio. Si usas un equipo compartido, necesitas permiso para crear experimentos.</p></section>;
  return <>
    <p>Cuenta: <strong>{session.user.email}</strong></p>
    {error && <p role="alert">{error}</p>}
    {!review && !busy && <button className="btn" onClick={() => setRetry(n => n + 1)}>Volver a comprobar</button>}
    {busy && <p role="status">{review ? 'Guardando…' : 'Recuperando la ficha y tus proyectos…'}</p>}
    {saved ? <><section className="business-plugin-section business-plugin-callout" role="status"><h2>Experimento guardado</h2><p><strong>{saved.title}</strong> · {saved.project_name}</p><p>{saved.message}</p><p>En la app, selecciona este proyecto para ver la ficha.</p><a className="btn primary" href="/experimentos">Abrir mis experimentos</a></section></> : review && <>
      <section className="business-plugin-section"><h2>{review.experiment.title}</h2>
        <dl>{Object.entries(labels).map(([key, label]) => { const value = review.experiment[key as keyof typeof labels]; return value !== undefined && value !== '' ? <div key={key} style={{ marginBottom: 16 }}><dt><strong>{label}</strong></dt><dd style={{ margin: '4px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</dd></div> : null; })}</dl>
      </section>
      <section className="business-plugin-section business-plugin-callout"><h2>Guardar en mi proyecto</h2>
        {review.projects.length ? <><label htmlFor="plugin-save-project">Proyecto de destino</label><select id="plugin-save-project" value={project} onChange={e => setProject(e.target.value)} disabled={busy} style={{ display: 'block', width: '100%', margin: '10px 0 20px', padding: 12, color: '#0b1220', background: '#fff' }}><option value="">Elige un proyecto</option>{review.projects.map(p => <option key={p.id} value={p.id}>{p.workspace_name} · {p.title}</option>)}</select><p>Se creará una ficha de experimento contigo como Responsable. Las fichas existentes permanecerán sin cambios.</p><button className="btn primary" onClick={() => void save()} disabled={!project || busy}>Confirmar y guardar experimento</button></> : <><p>No tienes proyectos con permiso para crear experimentos. Crea un proyecto en tu espacio o solicita permiso en tu equipo. Después vuelve aquí y pulsa «Volver a comprobar».</p><a className="btn" href="/proyectos" target="_blank" rel="noopener noreferrer">Abrir mis proyectos</a><button className="btn" onClick={() => setRetry(n => n + 1)} disabled={busy}>Volver a comprobar</button></>}
      </section>
    </>}
  </>;
}
