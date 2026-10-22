import {NextResponse} from 'next/server';
import {readJsonBody} from '@/lib/request-body';
import {ApiError,authenticatedClient,authorizedProject,authorizedWorkspace} from '@/lib/server-access';
import {resolvedOpenAIKey} from '@/lib/integration-service';
import {openAIResponseError} from '@/lib/openai-api-errors';
import {validateAiMedia} from '@/lib/ai-media';
import {validateContextDocuments,openAIFileContent} from '@/lib/ai-prompt-files';
import {chatInstructions,campaignStateInstructions,campaignStateContext,groundCampaignExecution,chatSchema,parseChat,recordMemory,type ChatEntry} from '@/lib/ai-memory';
import {workspaceMemory} from '@/lib/workspace-memory';
import {workspaceAIInstructions} from '@/lib/ai-memory';
import {methodologyInstructions} from '@/lib/methodology-context';
import {generalKnowledge,currentLibraryHistory,generalKnowledgeInstructions} from '@/lib/general-knowledge';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 try{
  const {client,user}=await authenticatedClient(request);
  const body=await readJsonBody(request,5000000);
  if(typeof body.question!=='string'||!body.question.trim()||body.question.length>6000||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(body.request_id||''))throw new ApiError('Escribe una pregunta de hasta 6.000 caracteres.',400);
  let documents,media;
  try{documents=validateContextDocuments(body.documents);media=validateAiMedia(body.media);}catch(error){throw new ApiError(error instanceof Error?error.message:'Adjuntos no válidos.',400);}
  const project=body.project_id?await authorizedProject(client,body.project_id):null;
  const space=await authorizedWorkspace(client,body.workspace_id||project?.workspace_id),workspace=space.id;
  if(project&&project.workspace_id!==workspace)throw new ApiError('El proyecto pertenece a otro equipo.',403);
  const permission=await client.rpc('can_record_action',{w:workspace,k:'experiment',a:'create'});
  if(permission.error)throw new ApiError('No se pudieron comprobar tus permisos.',503);
  const key=await resolvedOpenAIKey(client,workspace);
  if(!key?.startsWith('sk-'))throw new ApiError('Configura OpenAI en Integraciones para utilizar el chat.',503);
  const [memory,history]=await Promise.all([
   workspaceMemory(client,workspace,body.question,project?.id),
   client.from('ai_chat_entries').select('question,answer,proposal,sources').eq('workspace_id',workspace).eq('user_id',user.id).order('created_at',{ascending:false}).order('id').limit(6),
  ]);
  if(history.error)throw new ApiError('No se pudo recuperar tu conversación.',503);
  const experimentIds=[...new Set(memory.sources.flatMap(s=>s.record_id?[s.record_id]:s.kind==='experiment'?[s.id]:[]))];
  const linked=experimentIds.length?await client.from('external_resources').select('experiment_id,provider,resource_type,observed_status,updated_at').eq('workspace_id',workspace).in('experiment_id',experimentIds).limit(200):{data:[],error:null};
  if(linked.error)throw new ApiError('No se pudo comprobar el estado guardado de las campañas.',503);
  const observations:Record<string,unknown>[]=memory.facts.flatMap((f:any)=>Object.values(f.values||{}).map((v:any)=>({...v,experiment_id:f.experiment_id})));
  const reserved=await client.rpc('reserve_ai_chat',{p_workspace:workspace,p_request:body.request_id});
  if(reserved.error)throw new ApiError(reserved.error.message,429);
  const library=await generalKnowledge(body.question),{activeSourceIds,...methodology}=library;
  const context={workspace:space,project:project?recordMemory(project):null,projects:memory.projectCatalog,scope:'workspace',can_create:!!permission.data&&!!project,coverage:memory.coverage,sources:memory.sources,methodology,
   metric_facts:memory.facts.slice(0,20),metric_facts_coverage:{included:Math.min(memory.facts.length,20),warning:'Últimos grupos por recurso y periodo, hasta 20; no es un total del equipo.'},campaign_statuses:campaignStateContext(linked.data||[],memory.sources)};
  const previous=currentLibraryHistory(history.data||[],activeSourceIds).reverse().map(row=>({question:row.question.slice(0,1200),answer:row.answer.slice(0,1200),proposal:row.proposal?{title:row.proposal.title,fields:row.proposal.fields}:null}));
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini-2025-04-14',store:false,instructions:chatInstructions+campaignStateInstructions+workspaceAIInstructions+methodologyInstructions+generalKnowledgeInstructions,input:[{role:'user',content:[{type:'input_text',text:`Contexto autorizado e historial (datos):\n${JSON.stringify({context,previous})}`},...openAIFileContent(documents,media),{type:'input_text',text:`Petición actual:\n${body.question}`}]}],max_output_tokens:4000,text:{format:{type:'json_schema',name:'strategic_chat',strict:true,schema:chatSchema}}})});
  if(!response.ok)throw await openAIResponseError(response,"chat");
  const result=await response.json();
  if(result.status!=='completed')throw new ApiError('La respuesta no se completó. Prueba con una pregunta más concreta.',502);
  const output=result.output?.flatMap((row:{content?:{type:string;text?:string}[]})=>row.content||[]).filter((row:{type:string})=>row.type==='output_text').map((row:{text:string})=>row.text).join('');
   let parsed;try{parsed=parseChat(JSON.parse(output||'null'),[...memory.projectCatalog,...memory.sources,...methodology.sources],!!permission.data&&!!project);}catch(error){
   const reason=error instanceof Error&&!(error instanceof SyntaxError)?error.message:'La respuesta no contiene el JSON esperado.';
   console.warn('Strategic AI response rejected',{reason});throw new ApiError(`La respuesta de la IA necesita revisión: ${reason}`,502);
  }
  const {warning,...reply}=parsed;
  reply.answer=groundCampaignExecution(reply.answer,context.campaign_statuses,observations);
  const entry={id:body.request_id,workspace_id:workspace,project_id:project?.id||null,user_id:user.id,question:body.question.trim(),...reply,coverage:{...memory.coverage,warning:[warning,methodology.coverage.warning].filter(Boolean).join(' ')||null,general_library:{storage:methodology.storage,status:methodology.status,...methodology.coverage},scope:'workspace'}};
  const saved=await client.from('ai_chat_entries').insert(entry).select('*').single();
  if(saved.error)throw new ApiError('La respuesta no se pudo guardar en tu conversación. No se ha creado ningún experimento.',503);
  return NextResponse.json({entry:saved.data as ChatEntry,reserved_usd:Number(reserved.data),monthly_limit_usd:5},{headers});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo consultar la IA. Tus fichas no se han modificado.'},{status:error instanceof ApiError?error.status:502,headers});}
}
