import {experimentCampaignName} from './campaign-name';
import {ApiError} from './server-access';
import {executionFromFields} from './execution-plan';
import {smartleadId,smartleadRequest,type SmartleadConnection} from './smartlead';
import type {Item} from './model';
import type {Variant} from './monitoring';
export type SmartleadRecipe={name:string;revision:string;connection_revision:string;variants:{id:string;label:string;subject:string;body:string;allocation:number}[]};
export function smartleadRecipe(experiment:Item,code:string,variants:Variant[],connection:SmartleadConnection):SmartleadRecipe{
 const plan=executionFromFields(experiment.fields);
 if(experiment.fields.channel!=='smartlead'||!plan||plan.variants.length!==2)throw new ApiError('Prepara exactamente dos variantes de correo y guarda la ficha.',400);
 const prepared=plan.variants.map(v=>{const bound=variants.find(x=>x.label===v.label);if(!bound||!v.headline?.trim()||/[\r\n]/.test(v.headline)||v.headline.length>200||!v.body?.trim())throw new ApiError('Cada variante necesita un asunto, texto y vínculo guardado.',400);return {id:bound.id,label:v.label,subject:v.headline.trim(),body:v.body.trim(),allocation:v.allocation??50};});
 if(prepared.some(v=>v.allocation!==50))throw new ApiError('Esta primera preparación de Smartlead utiliza reparto igual: 50% por variante.',400);
 if(prepared[0].subject===prepared[1].subject&&prepared[0].body===prepared[1].body)throw new ApiError('Las dos variantes deben probar contenidos diferentes.',400);
 return {name:experimentCampaignName(experiment.title),revision:experiment.updated_at,connection_revision:connection.revision,variants:prepared};
}
export class SmartleadWriteError extends ApiError {constructor(message:string,public uncertain:boolean){super(message,502);}}
// No automatic retries, no activation, recipients or sender assignment.
export async function smartleadWrite(c:SmartleadConnection,path:string,body:unknown,fetcher:typeof fetch=fetch){
 const url=new URL(`https://server.smartlead.ai/api/v1/${path}`);url.searchParams.set('api_key',c.key);
 let response;try{response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});}catch{throw new SmartleadWriteError('Smartlead no confirmó el envío. Comprueba sus borradores antes de repetir.',true);}
 const result=await response.json().catch(()=>null);
 if(!response.ok)throw new SmartleadWriteError(response.status===429?'Smartlead limita las solicitudes.':'Smartlead rechazó la preparación.',response.status>=500||response.status<400);
 if(!result||result.ok===false||result.success===false||result.error)throw new SmartleadWriteError('Smartlead no confirmó la preparación.',true);
 return result;
}
export function smartleadSequence(recipe:SmartleadRecipe){
 return [{seq_number:1,seq_delay_details:{delay_in_days:0},variant_distribution_type:'MANUALLY_EQUAL',variants:recipe.variants.map((v,i)=>({variant_label:i===0?'A':'B',subject:v.subject,email_body:smartleadHtml(v.body)}))}];
}
export function smartleadHtml(text:string){return '<p>'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\r?\n/g,'<br>')+'</p>';}
export async function smartleadVerifyDraft(c:SmartleadConnection,id:string,recipe:SmartleadRecipe,fetcher:typeof fetch=fetch){
 const campaign=await smartleadRequest(c,`campaigns/${smartleadId(id)}`,{},fetcher);
 if(String(campaign.id)!==id||!['DRAFTED','DRAFT'].includes(campaign.status))throw new ApiError('La campaña no está confirmada como borrador. Revisa Smartlead.',502);
 const result=await smartleadRequest(c,`campaigns/${id}/sequences`,{},fetcher);
 const rows=Array.isArray(result)?result:result.data;
 const sequence=Array.isArray(rows)&&rows.length===1?rows[0]:null;
 const variants=sequence?.sequence_variants??sequence?.variants??sequence?.seq_variants;
 if(!sequence||sequence.seq_number!==1||!Array.isArray(variants)||variants.length!==2||recipe.variants.some(v=>!variants.some((x:any)=>x.subject===v.subject&&x.email_body===smartleadHtml(v.body))))throw new ApiError('Smartlead no confirmó las dos variantes guardadas. Conserva el ID y revisa el borrador; no repitas la creación.',502);
 return {type:'campaign',id,label:recipe.name,variant:null};
}
