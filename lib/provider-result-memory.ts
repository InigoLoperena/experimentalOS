import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ExternalResource,CsvMetric} from './monitoring';
export async function persistProviderResult(client:SupabaseClient,resource:ExternalResource,data:unknown,metrics:CsvMetric[],start:string|null,end:string|null){
 const permission=await client.rpc('can_record_action',{w:resource.workspace_id,k:'experiment',a:'edit'});
 if(permission.error||!permission.data)return {saved:false,note:'Consulta de solo lectura; no se han añadido resultados a la memoria.'};
 // Never save secrets or arbitrary provider request headers. Callers supply only report data.
 const content=JSON.stringify(data);
 if(content.length>500000)return {saved:false,note:'Resultado demasiado grande para una instantánea. No se ha truncado ni sustituido el historial.'};
 const hash=createHash('sha256').update(content).digest('hex');
 const saved=await client.rpc('save_provider_result',{r:resource.id,p_data:data,p_hash:hash,p_start:start,p_end:end,p_metrics:metrics});
 return saved.error?{saved:false,note:'Datos consultados, pero no se pudieron conservar. Vuelve a consultar para reintentar.'}:{saved:true,note:'Resultado conservado en la memoria del equipo, con recurso, periodo y fecha de consulta.'};
}
