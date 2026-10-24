import Link from 'next/link';
import {PublicSiteShell} from '../public-site-shell';
import {SITE_URL,publicMetadata} from '@/lib/public-site';
import {listPublishedPosts} from '@/lib/blog';
export const dynamic='force-dynamic';
const pageMetadata=publicMetadata({title:'Blog de Xperiments: hipótesis, experimentos y aprendizaje',description:'Ideas y metodología para validar propuestas de valor, diseñar experimentos y aprender con datos.',path:'/blog'});
export const metadata={...pageMetadata,alternates:{...pageMetadata.alternates,types:{'application/rss+xml':`${SITE_URL}/feed.xml`}}};
export default async function BlogPage(){
 const posts=await listPublishedPosts();
 return <PublicSiteShell><main id="contenido" className="blog-page"><p className="blog-eyebrow">EL BLOG DE XPERIMENTS</p><h1>Experimentar para tomar mejores decisiones</h1><p className="blog-intro">Hipótesis, investigación de clientes y experimentos para validar tu propuesta de valor y tu modelo de negocio.</p>
 {posts.length?<div className="blog-post-grid">{posts.map(post=><article className="blog-post-card" key={post.id}><p className="blog-meta"><time dateTime={post.published_at!}>{new Intl.DateTimeFormat('es',{dateStyle:'long',timeZone:'UTC'}).format(new Date(post.published_at!))}</time></p><h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2><p>{post.excerpt}</p><Link href={`/blog/${post.slug}`}>Leer artículo →</Link></article>)}</div>:<div className="blog-empty"><h2>Estamos preparando los primeros artículos</h2><p>Este espacio reunirá guías prácticas sobre validación y experimentación. Todavía no hay artículos publicados.</p><Link href="/">Conoce Xperiments →</Link></div>}
 <div className="blog-footer-links"><a href="/feed.xml">RSS</a><Link href="/blog/administrar">Administrar blog</Link></div></main></PublicSiteShell>;
}
