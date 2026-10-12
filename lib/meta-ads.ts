import type { Item } from './model';
import { ApiError } from './server-access';
import { validateObservation, type CsvMetric } from './monitoring';
import {createHash} from 'node:crypto';

export type MetaCampaign = { id: string; name: string; status: string; url: string };
export type MetaAccount = { id: string; name: string; currency: string; timezone: string; active: boolean };
export type MetaReport = { resource_id: string | null; name: string; status: string; metrics: CsvMetric[]; fetched_at: string };
export type MetaConnection = { accountId: string; token: string };

export function metaId(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,30}$/.test(value)) throw new ApiError('Introduce un ID numérico de Meta válido.', 400);
  return value;
}

// The pilot credential belongs to one project, never to arbitrary user-editable fields.
export function metaConnection(project: Item, env: Record<string,string|undefined> = process.env): MetaConnection {
  if (project.id !== env.META_ADS_PROJECT_ID?.trim() || project.workspace_id !== env.META_ADS_WORKSPACE_ID?.trim())
    throw new ApiError('Este proyecto no tiene una conexión de Meta autorizada.', 403);
  if (!env.META_ADS_ACCESS_TOKEN || !env.META_ADS_ACCOUNT_ID) throw new ApiError('La conexión de Meta aún no está configurada.', 503);
  return { accountId: metaId(env.META_ADS_ACCOUNT_ID.trim()), token: env.META_ADS_ACCESS_TOKEN.trim() };
}

export function metaPeriod(start: unknown, end: unknown) {
  const valid = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!valid(start) || !valid(end) || end < start || (Date.parse(end)-Date.parse(start))/86400000 > 30 || end > new Date().toISOString().slice(0,10))
    throw new ApiError('Elige un periodo de hasta 31 días, sin fechas futuras.', 400);
  return { since: start, until: end };
}

// Fixed origin/version, GET only, bearer header, no following provider pagination URLs.
export async function metaJson(path: string, params: Record<string,string>, token: string, fetcher: typeof fetch = fetch): Promise<Record<string, unknown>> {
  if (path!=='search'&&!/^(act_)?\d{1,30}(\/(campaigns|insights|adsets|ads|thumbnails|adspixels))?$/.test(path)) throw new ApiError('El recurso de Meta no es válido.', 400);
  const url = new URL(`https://graph.facebook.com/v26.0/${path}`);
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  let response: Response;
  try { response = await fetcher(url, { method:'GET', headers:{ Authorization:`Bearer ${token}` }, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(12000) }); }
  catch { throw new ApiError('Meta no respondió a tiempo. Inténtalo de nuevo.', 502); }
  let body: Record<string,unknown>;
  try { body = await response.json(); } catch { throw new ApiError('Meta devolvió una respuesta no válida.', 502); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('Meta devolvió una respuesta no válida.', 502);
  if (!response.ok || body.error) {
    const error = body.error as {code?: number} | undefined;
    console.warn('Meta read rejected', {status:response.status,code:error?.code});
    // Never return raw provider error messages or token-bearing URLs.
    if (error?.code === 190) throw new ApiError('El token de Meta ha caducado o fue revocado. Renueva el secreto en Vercel.', 502);
    if ([4,17,32,613].includes(error?.code || 0) || response.status === 429) throw new ApiError('Meta ha alcanzado su límite de consultas. Espera antes de actualizar.', 429);
    throw new ApiError('Meta rechazó la consulta. Revisa los permisos de lectura y el acceso a la cuenta publicitaria.', 502);
  }
  return body;
}

export async function metaAccount(connection: MetaConnection, fetcher: typeof fetch = fetch): Promise<MetaAccount> {
  const row = await metaJson(`act_${connection.accountId}`, {fields:'account_id,name,currency,timezone_name,account_status'}, connection.token, fetcher);
  if (row.account_id !== connection.accountId || typeof row.name !== 'string' || !/^[A-Z]{3}$/.test(String(row.currency)) || typeof row.timezone_name !== 'string')
    throw new ApiError('No se pudo verificar la identidad de la cuenta de Meta.', 502);
  return { id:connection.accountId, name:row.name, currency:String(row.currency), timezone:row.timezone_name, active:Number(row.account_status)===1 };
}

export async function metaCampaigns(connection: MetaConnection, after = '', fetcher: typeof fetch = fetch) {
  if (after.length > 2000) throw new ApiError('El cursor de Meta no es válido.', 400);
  const body = await metaJson(`act_${connection.accountId}/campaigns`, {fields:'id,name,effective_status,account_id',limit:'50',...(after ? {after} : {})}, connection.token, fetcher);
  if (!Array.isArray(body.data)) throw new ApiError('Meta no devolvió una lista de campañas válida.', 502);
  const campaigns: MetaCampaign[] = body.data.map((row: Record<string,unknown>) => {
    if (!row || row.account_id !== connection.accountId || typeof row.name !== 'string') throw new ApiError('Meta devolvió una campaña de otra cuenta.', 502);
    const id = metaId(row.id);
    return {id,name:row.name,status:String(row.effective_status || 'UNKNOWN'),url:`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${connection.accountId}&selected_campaign_ids=${id}`};
  });
  const paging = body.paging as {next?:unknown;cursors?:{after?:unknown}} | undefined;
  const next = paging?.next && typeof paging.cursors?.after === 'string' ? paging.cursors.after : null;
  if (next && next.length > 2000) throw new ApiError('La paginación de Meta no es válida.', 502);
  return {campaigns,next};
}

export function metaMetrics(rows: unknown, accountId: string, externalId: string, type: string, start: string, end: string, fetchedAt: string): CsvMetric[] {
  if (!Array.isArray(rows) || rows.length > 1) throw new ApiError('Meta devolvió un informe inesperado. No se importaron datos.', 502);
  if (!rows.length) return []; // No data is not evidence of zero performance.
  const row = rows[0] as Record<string,unknown>;
  if (!row || row.account_id !== accountId || row[`${type}_id`] !== externalId || typeof row.date_start !== 'string' || typeof row.date_stop !== 'string' ||
      row.date_start !== start || row.date_stop !== end || !/^[A-Z]{3}$/.test(String(row.account_currency)))
    throw new ApiError('La cuenta, recurso o periodo del informe no coincide con la consulta.', 502);
  const base=['impressions','clicks','reach','spend'].flatMap(metric => {
    if (row[metric] == null) return [];
    if (!/^\d+(\.\d+)?$/.test(String(row[metric]))) throw new ApiError('Meta devolvió una métrica no válida.', 502);
    const value: CsvMetric = {external_id:externalId,metric,value:Number(row[metric]),unit:metric==='spend'?'currency':'count',currency:metric==='spend'?String(row.account_currency):null,
      period_start:row.date_start as string,period_end:row.date_stop as string,
      notes:`Origen: Meta Insights API v26.0; cuenta ${accountId}; consultado ${fetchedAt}. Clics = todos los clics, no la North Star. Alcance no aditivo. Sin inferencias sobre conversiones o causalidad.`};
    try { validateObservation(value); } catch { throw new ApiError('Meta devolvió una métrica no válida.', 502); }
    return [value];
  });
  // Keep each provider action distinct: aliases/overlapping attribution are not additive.
  for(const [field,prefix] of [['actions','action'],['action_values','value'],['video_p25_watched_actions','video25'],['video_p50_watched_actions','video50'],['video_p75_watched_actions','video75'],['video_p100_watched_actions','video100']] as const){
    if(row[field]==null)continue;
    if(!Array.isArray(row[field])||(row[field] as unknown[]).length>200)throw new ApiError('Meta devolvió acciones no válidas.',502);
    const seen=new Set<string>();
    for(const entry of row[field] as {action_type?:unknown;value?:unknown}[]){
      if(!entry||typeof entry.action_type!=='string'||! /^[a-zA-Z0-9_.-]{1,160}$/.test(entry.action_type)||! /^\d+(\.\d+)?$/.test(String(entry.value)))throw new ApiError('Meta devolvió acciones no válidas.',502);
      if(seen.has(entry.action_type))throw new ApiError('Meta devolvió acciones duplicadas. No se importaron datos.',502);seen.add(entry.action_type);
      const key=`${prefix}_${entry.action_type.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,40)}_${createHash('sha256').update(entry.action_type).digest('hex').slice(0,8)}`;
      const value=Number(entry.value),money=field==='action_values';
      const metric:CsvMetric={external_id:externalId,metric:key,value,unit:money?'currency':Number.isInteger(value)?'count':'number',currency:money?String(row.account_currency):null,period_start:start,period_end:end,notes:`Meta ${field} · ${entry.action_type}; cuenta ${accountId}; consultado ${fetchedAt}. Atribución predeterminada de Meta. Eventos y aliases pueden solaparse: no sumar ni inferir causalidad. Ausencia no significa cero.`};
      try{validateObservation(metric);}catch{throw new ApiError('Meta devolvió una métrica no válida.',502);}base.push(metric);
    }
  }
  return base;
}

export async function metaReport(connection: MetaConnection, externalId: string, type: string, start: string, end: string, fetcher: typeof fetch = fetch) {
  metaId(externalId);
  if (!['campaign','adset','ad'].includes(type)) throw new ApiError('Puedes consultar campañas, conjuntos de anuncios o anuncios de Meta.',400);
  const period = metaPeriod(start,end);
  const detail = await metaJson(externalId,{fields:'id,name,account_id,effective_status'},connection.token,fetcher);
  if (detail.id !== externalId || detail.account_id !== connection.accountId || typeof detail.name !== 'string') throw new ApiError('Este recurso no pertenece a la cuenta de Meta autorizada.',403);
  const result = await metaJson(`${externalId}/insights`,{fields:`account_id,${type}_id,account_currency,date_start,date_stop,impressions,clicks,reach,spend,actions,action_values,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions`,time_range:JSON.stringify(period),action_report_time:'conversion',limit:'2'},connection.token,fetcher);
  const fetchedAt = new Date().toISOString();
  return {name:detail.name,status:String(detail.effective_status || 'UNKNOWN'),metrics:metaMetrics(result.data,connection.accountId,externalId,type,start,end,fetchedAt),fetched_at:fetchedAt};
}
