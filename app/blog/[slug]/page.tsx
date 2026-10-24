import Link from 'next/link';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import {PublicSiteShell} from '../../public-site-shell';
import {getPublishedPost} from '@/lib/blog';
import {SITE_URL,publicMetadata,jsonLd} from '@/lib/public-site';
import {BlogContent} from '../blog-content';
export const dynamic='force-dynamic';
const publishedPost=cache(getPublishedPost);
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props){const post=await publishedPost((await params).slug);if(!post)notFound();const metadata=publicMetadata({title:post.title,description:post.excerpt,path:`/blog/${post.slug}`});return {...metadata,openGraph:{...metadata.openGraph,type:'article' as const,publishedTime:post.published_at!,modifiedTime:post.updated_at,authors:[post.author_name]}};}
export default async function BlogArticle({params}:Props){
 const post=await publishedPost((await params).slug);if(!post)notFound();
 const schema={'@context':'https://schema.org','@type':'BlogPosting',headline:post.title,description:post.excerpt,datePublished:post.published_at,dateModified:post.updated_at,inLanguage:'es',mainEntityOfPage:`${SITE_URL}/blog/${post.slug}`,author:{'@type':'Person',name:post.author_name},publisher:{'@type':'Organization',name:'Xperiments',url:SITE_URL}};
 const breadcrumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Inicio',item:SITE_URL},{'@type':'ListItem',position:2,name:'Blog',item:`${SITE_URL}/blog`},{'@type':'ListItem',position:3,name:post.title,item:`${SITE_URL}/blog/${post.slug}`}]};
 return <PublicSiteShell><main id="contenido" className="blog-page blog-article"><Link href="/blog">← Volver al blog</Link><article><header><p className="blog-eyebrow">EXPERIMENTACIÓN Y APRENDIZAJE</p><h1>{post.title}</h1><p className="blog-intro">{post.excerpt}</p><p className="blog-meta">{post.author_name} · <time dateTime={post.published_at!}>{new Intl.DateTimeFormat('es',{dateStyle:'long',timeZone:'UTC'}).format(new Date(post.published_at!))}</time></p></header><BlogContent markdown={post.body_markdown}/></article><aside className="blog-article-cta"><h2>Convierte lo aprendido en un experimento</h2><p>Organiza hipótesis, resultados y aprendizajes en Xperiments.</p><Link href="/">Conoce la plataforma →</Link></aside><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd([schema,breadcrumbs])}}/></main></PublicSiteShell>;
}
