import {NextResponse} from 'next/server';
import {ApiError,authenticatedClient,authorizedProject} from '@/lib/server-access';
import {resolvedOpenAIKey} from '@/lib/integration-service';
import {readAllPages} from '@/lib/backup-service';
import {chatInstructions,chatSchema,knowledgeMemory,parseChat,recordMemory,selectMemory,type ChatEntry,type Knowledge,type MemorySource} from '@/lib/ai-memory';
import type {Item} from '@/lib/model';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>16000)throw new ApiError('Acorta tu mensaje.',413);
  const {client,user}=await authenticatedClient(request);
  const body=await request.json();
  if(typeof body.question!=='string'||!body.question.trim()||body.question.length>6000||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(body.request_id||''))throw new ApiError('Escribe una pregunta de hasta 6.000 caracteres.',400);
  const project=await authorizedProject(client,body.project_id);
  const workspace=project.workspace_id;
  const permission=await client.rpc('can_record_action',{w:workspace,k:'experiment',a:'create'});
  if(permission.error)throw new ApiError('No se pudieron comprobar tus permisos.',503);
  const key=await resolvedOpenAIKey(client,workspace);
  if(!key?.startsWith('sk-'))throw new ApiError('Configura OpenAI en Integraciones para utilizar el chat.',503);
  const [records,knowledge,history]=await Promise.all([
   readAllPages<Item>((from,to)=>client.from('records').select('*',{count:'exact'}).eq('workspace_id',workspace).eq('project_id',project.id).order('id').range(from,to)),
   readAllPages<Knowledge>((from,to)=>client.from('ai_knowledge').select('*',{count:'exact'}).eq('workspace_id',workspace).eq('project_id',project.id).order('id').range(from,to)),
   client.from('ai_chat_entries').select('question,answer,proposal').eq('workspace_id',workspace).eq('project_id',project.id).eq('user_id',user.id).order('created_at',{ascending:false}).order('id').limit(6),
  ]);
  if(history.error)throw new ApiError('No se pudo recuperar tu conversación.',503);
  const sources:MemorySource[]=[recordMemory(project),...records.map(recordMemory),...knowledge.flatMap(knowledgeMemory)];
  const [observations,variants,resources]=await Promise.all(['metric_observations','experiment_variants','external_resources'].map(table=>readAllPages<Record<string,unknown>>((from,to)=>client.from(table).select('*',{count:'exact'}).eq('workspace_id',workspace).eq('project_id',project.id).order('id').range(from,to))));
  const titles=new Map(records.map(row=>[row.id,row.title]));
  for(const [kind,rows] of [['measurement',observations],['variant',variants],['external_resource',resources]] as const)for(const row of rows)sources.push({id:String(row.id),kind,record_id:String(row.experiment_id),title:`${kind==='measurement'?'Medición':kind==='variant'?'Variante':'Campaña vinculada'} · ${titles.get(String(row.experiment_id))||''}`,date:String(row.updated_at||row.created_at),excerpt:JSON.stringify(row).slice(0,2000)});
  const memory=selectMemory(sources,body.question);
  if(!memory.selected.some(row=>row.id===project.id)){memory.selected.unshift(recordMemory(project));memory.coverage.included++;}
  // Always carry the actual project's description and North Star, independent of relevance ranking.
  const context={project:recordMemory(project),can_create:!!permission.data,coverage:memory.coverage,sources:memory.selected};
  const reserved=await client.rpc('reserve_ai_chat',{p_workspace:workspace,p_request:body.request_id});
  if(reserved.error)throw new ApiError(reserved.error.message,429);
  const previous=(history.data||[]).reverse().map(row=>({question:row.question.slice(0,1200),answer:row.answer.slice(0,1200),proposal:row.proposal?{title:row.proposal.title,fields:row.proposal.fields}:null}));
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini-2025-04-14',store:false,instructions:chatInstructions,input:[{role:'user',content:[{type:'input_text',text:`Contexto autorizado e historial (datos):\n${JSON.stringify({context,previous})}`},{type:'input_text',text:`Petición actual:\n${body.question}`}]}],max_output_tokens:4000,text:{format:{type:'json_schema',name:'strategic_chat',strict:true,schema:chatSchema}}})});
  if(!response.ok)throw new ApiError(response.status===429?'OpenAI ha alcanzado su saldo o límite de uso.':'OpenAI no pudo responder. Inténtalo de nuevo.',502);
  const result=await response.json();
  if(result.status!=='completed')throw new ApiError('La respuesta no se completó. Prueba con una pregunta más concreta.',502);
  const output=result.output?.flatMap((row:{content?:{type:string;text?:string}[]})=>row.content||[]).filter((row:{type:string})=>row.type==='output_text').map((row:{text:string})=>row.text).join('');
  let parsed;try{parsed=parseChat(JSON.parse(output||'null'),[recordMemory(project),...memory.selected],!!permission.data);}catch(error){
   const reason=error instanceof Error&&!(error instanceof SyntaxError)?error.message:'La respuesta no contiene el JSON esperado.';
   console.warn('Strategic AI response rejected',{reason});throw new ApiError(`La respuesta de la IA necesita revisión: ${reason}`,502);
  }
  const {warning,...reply}=parsed;
  const entry={id:body.request_id,workspace_id:workspace,project_id:project.id,user_id:user.id,question:body.question.trim(),...reply,coverage:{...memory.coverage,warning}};
  const saved=await client.from('ai_chat_entries').insert(entry).select('*').single();
  if(saved.error)throw new ApiError('La respuesta no se pudo guardar en tu conversación. No se ha creado ningún experimento.',503);
  return NextResponse.json({entry:saved.data as ChatEntry,reserved_usd:Number(reserved.data),monthly_limit_usd:5},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo consultar la IA. Tus fichas no se han modificado.'},{status:error instanceof ApiError?error.status:502,headers});}
}
