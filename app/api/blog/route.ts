import {NextResponse} from 'next/server';
import {authenticatedClient,ApiError} from '@/lib/server-access';
import {readJsonBody} from '@/lib/request-body';
import {blogColumns,validateBlogPost} from '@/lib/blog';

export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
async function editor(request:Request){
 const access=await authenticatedClient(request);
 if(!access.user.email_confirmed_at)throw new ApiError('Confirma tu correo para administrar el blog.',403);
 const permission=await access.client.rpc('is_blog_editor');
 if(permission.error)throw new ApiError('No se pudo comprobar el acceso al blog.',503);
 if(permission.data!==true)throw new ApiError('Solo el administrador del sitio puede editar el blog.',403);
 return access.client;
}
function failed(error:unknown){return NextResponse.json({error:error instanceof ApiError?error.message:'No se pudo completar la operación del blog.'},{status:error instanceof ApiError?error.status:503,headers});}
export async function GET(request:Request){
 try{const client=await editor(request);const result=await client.from('blog_posts').select(blogColumns).order('updated_at',{ascending:false});if(result.error)throw new ApiError('No se pudieron cargar los artículos.',503);return NextResponse.json({posts:result.data},{headers});}catch(error){return failed(error);}
}
export async function POST(request:Request){
 try{
  const client=await editor(request),body=await readJsonBody(request,420000);
  if(!['save','delete'].includes(body.action)||Object.keys(body).some(key=>!['action','id','expected_updated_at','post'].includes(key)))throw new ApiError('Acción de blog inválida.',400);
  const updating=body.id!=null;
  if(updating&&(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)||typeof body.expected_updated_at!=='string'||!Number.isFinite(Date.parse(body.expected_updated_at))))throw new ApiError('Falta la versión actual del artículo. Recarga antes de guardar.',400);
  if(body.action==='delete'){
   if(!updating)throw new ApiError('Selecciona el artículo que quieres eliminar.',400);
   const result=await client.from('blog_posts').delete().eq('id',body.id).eq('updated_at',body.expected_updated_at).select('id').maybeSingle();
   if(result.error)throw new ApiError('No se pudo eliminar el artículo.',503);if(!result.data)throw new ApiError('El artículo cambió. Recarga para revisar la última versión.',409);
   return NextResponse.json({deleted:true},{headers});
  }
  const post=validateBlogPost(body.post);
  const query=updating?client.from('blog_posts').update(post).eq('id',body.id).eq('updated_at',body.expected_updated_at):client.from('blog_posts').insert(post);
  const result=await query.select(blogColumns).maybeSingle();
  if(result.error){if(result.error.code==='23505')throw new ApiError('Esa URL ya pertenece a otro artículo.',409);if(result.error.code==='23514'||result.error.code==='P0001')throw new ApiError('Revisa el artículo. La URL de un artículo ya publicado se conserva para evitar enlaces rotos.',400);throw new ApiError('No se pudo guardar el artículo.',503);}
  if(!result.data)throw new ApiError('El artículo cambió. Recarga para revisar la última versión.',409);
  return NextResponse.json({post:result.data},{headers});
 }catch(error){return failed(error);}
}
