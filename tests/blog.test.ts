import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {validateBlogPost,listPublishedPosts,getPublishedPost} from '../lib/blog';
import {safeBlogHref,blogMarkdownBlocks} from '../lib/blog-markdown';
import {BlogContent} from '../app/blog/blog-content';
import {GET,POST} from '../app/api/blog/route';

const valid={title:'Una hipótesis a la vez',slug:'una-hipotesis',excerpt:'Decide antes qué resultado cambiaría tu decisión.',body_markdown:'## Pregunta\n\nUn experimento concreto.',author_name:'Autora QA',status:'draft' as const};
test('blog input validates published requirements, stable slugs, lengths and editorial-only fields',()=>{
 assert.deepEqual(validateBlogPost(valid),valid);
 assert.throws(()=>validateBlogPost({...valid,status:'published',body_markdown:''}),/contenido/);
 for(const slug of ['administrar','rss','dos palabras','MAYUSCULAS','../../privado','https://x.test','a'.repeat(101)])assert.throws(()=>validateBlogPost({...valid,slug}));
 for(const extra of [{created_by:'someone'},{published_at:new Date().toISOString()},{workspace_id:'other-team'}])assert.throws(()=>validateBlogPost({...valid,...extra}),/campos no admitidos/);
 assert.throws(()=>validateBlogPost({...valid,title:' '}));assert.throws(()=>validateBlogPost({...valid,body_markdown:'a'.repeat(100001)}));
 assert.equal(validateBlogPost({...valid,status:'published'}).status,'published');
});
test('Markdown stays semantic without executing HTML or unsafe link protocols',()=>{
 for(const href of ['javascript:alert(1)','data:text/html,evil','//evil.test','/\\evil.test','java\nscript:evil','https://x.test/with space'])assert.equal(safeBlogHref(href),null);
 for(const href of ['https://example.org/test','http://example.org','mailto:hello@example.org','/blog','#metodo'])assert.equal(safeBlogHref(href),href);
 const markdown='# Título\n\n<script>alert(1)</script>\n\n[Inseguro](javascript:evil) [Seguro](https://example.org) **Evidencia**\n\n- Hipótesis\n- Resultado\n\n1. Diseñar\n2. Revisar\n\n> Una fuente\n\n```html\n<img src=x onerror=evil>\n```';
 const html=renderToStaticMarkup(createElement(BlogContent,{markdown}));
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('<img'));
 for(const fragment of ['<h2>Título</h2>','&lt;script&gt;','href="https://example.org"','<strong>Evidencia</strong>','<ul>','<ol>','<blockquote>','<pre><code>'])assert.ok(html.includes(fragment),fragment);
 assert.equal(blogMarkdownBlocks('un párrafo\notra línea')[0].text,'un párrafo otra línea');
});
test('public blog queries never inherit editor auth and exclude drafts and future publication',async()=>{
 const original=globalThis.fetch,env={...process.env};process.env.NEXT_PUBLIC_SUPABASE_URL='https://blog.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='anon-test-key';let calls=0;
 globalThis.fetch=async(input,options)=>{const url=new URL(String(input));calls++;assert.equal(url.pathname,'/rest/v1/blog_posts');assert.equal(url.searchParams.get('status'),'eq.published');assert.match(url.searchParams.get('published_at')||'',/^lte\./);assert.ok(!url.searchParams.get('select')?.includes('created_by'));assert.equal(options?.cache,'no-store');const headers=new Headers(options?.headers);assert.equal(headers.get('authorization'),'Bearer anon-test-key');return Response.json(url.searchParams.has('slug')?null:[]);};
 try{assert.deepEqual(await listPublishedPosts(),[]);assert.equal(await getPublishedPost('draft-not-visible'),null);assert.equal(await getPublishedPost('../private'),null);assert.equal(calls,2);globalThis.fetch=async()=>Response.json({message:'table unavailable'},{status:503});await assert.rejects(listPublishedPosts(),/consultar/);}finally{globalThis.fetch=original;process.env=env;}
});
test('blog API requires a currently verified site editor and rejects workspace-owner access or stale writes',async()=>{
 const original=globalThis.fetch,env={...process.env};process.env.NEXT_PUBLIC_SUPABASE_URL='https://blog-api.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='anon-test-key';let allowed=false,confirmed=true,writes=0,concurrent=false;
 const id='33333333-3333-4333-8333-333333333333';
 globalThis.fetch=async(input,options)=>{const url=new URL(String(input));if(url.pathname==='/auth/v1/user')return Response.json({id,email:'verified@example.org',email_confirmed_at:confirmed?new Date().toISOString():null,aud:'authenticated',role:'authenticated'});if(url.pathname==='/rest/v1/rpc/is_blog_editor')return Response.json(allowed);if(url.pathname==='/rest/v1/blog_posts'){if(options?.method==='POST'||options?.method==='PATCH'||options?.method==='DELETE'){writes++;const payload=options.method==='DELETE'?null:JSON.parse(String(options.body));if(payload)assert.deepEqual(payload,valid);return Response.json(concurrent?null:{id,...valid,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),published_at:null});}return Response.json([]);}throw new Error(`Unexpected request ${url.pathname}`);};
 const request=(body:unknown)=>new Request('https://app.test/api/blog',{method:'POST',headers:{Authorization:'Bearer unit-session','Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await GET(new Request('https://app.test/api/blog'))).status,401);
  assert.equal((await POST(request({action:'save',post:valid}))).status,403);assert.equal(writes,0);
  allowed=true;confirmed=false;assert.equal((await POST(request({action:'save',post:valid}))).status,403);assert.equal(writes,0);
  confirmed=true;assert.equal((await POST(request({action:'save',post:{...valid,created_by:id}}))).status,400);assert.equal(writes,0);
  assert.equal((await POST(request({action:'save',post:valid}))).status,200);assert.equal(writes,1);
  concurrent=true;assert.equal((await POST(request({action:'save',id,expected_updated_at:new Date().toISOString(),post:valid}))).status,409);
  assert.equal((await POST(request({action:'delete',id,expected_updated_at:new Date().toISOString()}))).status,409);
  assert.equal((await GET(new Request('https://app.test/api/blog',{headers:{Authorization:'Bearer unit-session'}}))).status,200);
 }finally{globalThis.fetch=original;process.env=env;}
});
