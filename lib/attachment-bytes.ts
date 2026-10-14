import type {SupabaseClient} from '@supabase/supabase-js';
import {attachmentBucket,attachmentLimit,type Attachment} from './attachments';
import {ApiError} from './server-access';

// Server-side read through the user's JWT and private Storage policies.
export async function privateAttachmentBytes(client:SupabaseClient,attachment:Attachment){
 if(!attachment.storage_path?.startsWith(`${attachment.workspace_id}/${attachment.record_id}/`)||!attachment.size||attachment.size>attachmentLimit)throw new ApiError('El adjunto privado no es válido.',400);
 const result=await client.storage.from(attachmentBucket).download(attachment.storage_path);
 if(result.error||!result.data||result.data.size!==attachment.size)throw new ApiError('No se pudo leer el adjunto privado. Guarda los materiales antes de preparar.',400);
 return Buffer.from(await result.data.arrayBuffer());
}
