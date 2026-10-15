import {supabase} from './supabase';
export type WorkspaceDocument={id:string;workspace_id:string;project_id:string|null;knowledge_id:string|null;name:string;mime_type:string;size:number;storage_path:string;extraction_status:string;extraction_note:string;created_at:string};
const types:Record<string,string>={txt:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm'};
export async function indexWorkspaceDocument(workspace:string,id:string,signal?:AbortSignal){
 const {data}=await supabase!.auth.getSession();if(!data.session)throw new Error('Inicia sesión para indexar el documento.');
 const response=await fetch('/api/ai/documents',{method:'POST',signal,headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({workspace_id:workspace,document_id:id})});
 const value=await response.json();if(!response.ok)throw new Error(value.error||'No se pudo indexar. El original guardado se conserva.');return value;
}
export async function saveWorkspaceFile(workspace:string,project:string|null,file:File,id:string,signal?:AbortSignal){
 const mime=types[file.name.split('.').pop()?.toLowerCase()||''];
 if(!mime||!file.size||file.size>10*1024*1024||file.name.length>250)throw new Error('Adjunta un archivo admitido de hasta 10 MB.');
 const path=`${workspace}/${id}/original`;
 const inserted=await supabase!.from('ai_documents').insert({id,workspace_id:workspace,project_id:project,name:file.name,mime_type:mime,size:file.size,storage_path:path});
 if(inserted.error&&inserted.error.code!=='23505')throw new Error('No se pudo registrar el original. Revisa tus permisos para añadir conocimiento.');
 const upload=await supabase!.storage.from('ai-documents').upload(path,file,{contentType:mime,upsert:false});
 if(upload.error&&!['Duplicate','409'].includes(String(upload.error.statusCode))&&!/already exists/i.test(upload.error.message))throw new Error('El original no terminó de subirse. Reintenta el envío para completarlo.');
 return indexWorkspaceDocument(workspace,id,signal);
}
