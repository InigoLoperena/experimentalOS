import {createClient} from '@supabase/supabase-js';
import {ApiError} from './server-access';

export type BlogPost={id:string;slug:string;title:string;excerpt:string;body_markdown:string;author_name:string;status:'draft'|'published';published_at:string|null;created_at:string;updated_at:string};
export type BlogPostInput=Pick<BlogPost,'slug'|'title'|'excerpt'|'body_markdown'|'author_name'|'status'>;
export type BlogPostSummary=Omit<BlogPost,'body_markdown'>;
export const blogColumns='id,slug,title,excerpt,body_markdown,author_name,status,published_at,created_at,updated_at';
const blogSummaryColumns='id,slug,title,excerpt,author_name,status,published_at,created_at,updated_at';
export const blogSlugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateBlogPost(value:unknown):BlogPostInput{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('Revisa los datos del artículo.',400);
 const input=value as Record<string,unknown>;
 const fields=['slug','title','excerpt','body_markdown','author_name','status'];
 if(Object.keys(input).some(key=>!fields.includes(key)))throw new ApiError('El artículo contiene campos no admitidos.',400);
 const text=(key:string,max:number,required=false)=>{const raw=input[key];if(typeof raw!=='string'||raw.length>max)throw new ApiError(`Revisa ${key}: el texto no es válido o es demasiado largo.`,400);const result=raw.trim();if(required&&!result)throw new ApiError(`Completa ${key}.`,400);return result;};
 const title=text('title',180,true),slug=text('slug',100,true),excerpt=text('excerpt',360),body_markdown=text('body_markdown',100000),author_name=text('author_name',120,true);
 if(!blogSlugPattern.test(slug)||['administrar','feed','rss','api'].includes(slug))throw new ApiError('La URL solo admite letras minúsculas sin tildes, números y guiones; elige una URL no reservada.',400);
 if(input.status!=='draft'&&input.status!=='published')throw new ApiError('Estado de artículo inválido.',400);
 if(input.status==='published'&&(!excerpt||!body_markdown))throw new ApiError('Añade un resumen y el contenido antes de publicar.',400);
 return {title,slug,excerpt,body_markdown,author_name,status:input.status};
}

function publicBlogClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('El blog no tiene configurada su base de datos.');
 // Never inherit an editor session on public pages, feeds or metadata.
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})}});
}
export async function listPublishedPosts():Promise<BlogPostSummary[]>{
 const {data,error}=await publicBlogClient().from('blog_posts').select(blogSummaryColumns).eq('status','published').lte('published_at',new Date().toISOString()).order('published_at',{ascending:false});
 if(error)throw new Error('No se pudieron consultar los artículos publicados.');
 return data as BlogPostSummary[];
}
export async function getPublishedPost(slug:string):Promise<BlogPost|null>{
 if(!blogSlugPattern.test(slug)||slug.length>100)return null;
 const {data,error}=await publicBlogClient().from('blog_posts').select(blogColumns).eq('slug',slug).eq('status','published').lte('published_at',new Date().toISOString()).maybeSingle();
 if(error)throw new Error('No se pudo consultar el artículo publicado.');
 return data as BlogPost|null;
}
