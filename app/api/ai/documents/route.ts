import {NextResponse} from 'next/server';
import {authenticatedClient,authorizedWorkspace,ApiError} from '@/lib/server-access';
import {readJsonBody} from '@/lib/request-body';
import {documentText} from '@/lib/ai-document-text';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(request:Request){
 try{
  const {client}=await authenticatedClient(request),body=await readJsonBody(request,2000);
  const space=await authorizedWorkspace(client,body.workspace_id);
  const permission=await client.rpc('can_record_action',{w:space.id,k:'learning',a:'create'});
  if(permission.error||!permission.data)throw new ApiError('Necesitas permiso para añadir conocimiento al equipo.',403);
  if(body.attachment_id){
   const attachment=await client.from('record_attachments').select('*').eq('id',body.attachment_id).eq('workspace_id',space.id).single();
   if(attachment.error||!attachment.data||!['pdf','docx'].includes(attachment.data.kind))throw new ApiError('Selecciona un documento legible de una ficha autorizada.',403);
   const a=attachment.data,record=await client.from('records').select('id,project_id,title').eq('id',a.record_id).eq('workspace_id',space.id).single();
   if(record.error||!record.data)throw new ApiError('Ficha no autorizada.',403);
   const exists=await client.from('ai_knowledge').select('id').eq('id',a.id).eq('workspace_id',space.id).maybeSingle();
   if(exists.error)throw new ApiError('No se pudo comprobar el documento.',503);if(exists.data)return NextResponse.json({id:exists.data.id});
   const original=await client.storage.from('record-attachments').download(a.storage_path);
   if(original.error||!original.data||original.data.size!==a.size)throw new ApiError('No se pudo recuperar el original completo.',409);
   const extracted=await documentText(a.name,new Uint8Array(await original.data.arrayBuffer()));
   if(!extracted.text)return NextResponse.json({id:null,note:extracted.note});
   const added=await client.from('ai_knowledge').insert({id:a.id,workspace_id:space.id,project_id:record.data.project_id,title:a.name,content:extracted.text,format:'text',source:`Adjunto de ${record.data.title}`,evidence:`Original privado en la ficha ${record.data.title}`,category:'research',validation:'unverified'});
   if(added.error&&added.error.code!=='23505')throw new ApiError('No se pudo guardar el texto del adjunto.',503);
   return NextResponse.json({id:a.id,note:extracted.note});
  }
  const {data:doc,error}=await client.from('ai_documents').select('*').eq('id',body.document_id).eq('workspace_id',space.id).single();
  if(error||!doc)throw new ApiError('Documento no autorizado.',403);
  if(doc.knowledge_id)return NextResponse.json({id:doc.knowledge_id,note:doc.extraction_note});
  const existing=await client.from('ai_knowledge').select('id').eq('id',doc.id).eq('workspace_id',space.id).maybeSingle();
  if(existing.error)throw new ApiError('No se pudo comprobar la indexación.',503);
  if(existing.data){const finished=await client.from('ai_documents').update({knowledge_id:doc.id,extraction_status:'ready'}).eq('id',doc.id).eq('workspace_id',space.id);if(finished.error)throw new ApiError('El texto está guardado; actualiza el documento para completar su vínculo.',503);return NextResponse.json({id:doc.id});}
  const file=await client.storage.from('ai-documents').download(doc.storage_path);
  if(file.error||!file.data||file.data.size!==doc.size)throw new ApiError('El original no se ha subido completo. Puedes volver a adjuntarlo.',409);
  let extracted;
  try{extracted=await documentText(doc.name,new Uint8Array(await file.data.arrayBuffer()));}
  catch{await client.from('ai_documents').update({extraction_status:'failed',extraction_note:'Original conservado. No se pudo extraer todo el texto: aporta una copia legible de hasta 100.000 caracteres y 200 páginas.'}).eq('id',doc.id).eq('workspace_id',space.id);return NextResponse.json({id:null,note:'Original conservado, pendiente de una versión legible para indexar.'});}
  if(extracted.text){
   const saved=await client.from('ai_knowledge').insert({id:doc.id,workspace_id:space.id,project_id:doc.project_id,title:doc.name,content:extracted.text,format:'text',source:`Documento original: ${doc.name}`,validation:'unverified',category:'research'});
   if(saved.error&&saved.error.code!=='23505')throw new ApiError('El original está conservado, pero no se pudo guardar su texto. Reintenta la indexación.',503);
  }
  const finished=await client.from('ai_documents').update({knowledge_id:extracted.text?doc.id:null,extraction_status:extracted.text?'ready':'needs_review',extraction_note:extracted.note}).eq('id',doc.id).eq('workspace_id',space.id);
  if(finished.error)throw new ApiError('El original está conservado; reintenta para confirmar la indexación.',503);
  return NextResponse.json({id:extracted.text?doc.id:null,note:extracted.note});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo indexar el documento. El original guardado se conserva.'},{status:error instanceof ApiError?error.status:502});}
}
