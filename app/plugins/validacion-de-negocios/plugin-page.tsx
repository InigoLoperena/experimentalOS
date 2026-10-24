import type { ReactNode } from 'react';
import { pluginEditor, pluginEmail, pluginPages, pluginPath } from './plugin-info';
import { PublicSiteFooter } from '../../public-site-shell';
import { SITE_URL, jsonLd } from '@/lib/public-site';

export function PluginPage({ path, eyebrow, title, intro, children }: {
  path: string; eyebrow: string; title: string; intro: string; children: ReactNode;
}) {
  return <div className="business-plugin-site">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@graph':[
      {'@type':'WebPage',name:title,description:intro,url:`${SITE_URL}${path}`,inLanguage:'es',publisher:{'@type':'Person',name:pluginEditor,email:pluginEmail}},
      {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Xperiments',item:SITE_URL},{'@type':'ListItem',position:2,name:'Validación de negocios',item:`${SITE_URL}${pluginPath}`},...(path!==pluginPath?[{'@type':'ListItem',position:3,name:pluginPages.find(page=>page.path===path)?.label||title,item:`${SITE_URL}${path}`}]:[])]},
      ...(path===pluginPath?[{'@type':'SoftwareApplication',name:'Validación de negocios',description:intro,url:`${SITE_URL}${pluginPath}`,applicationCategory:'BusinessApplication',operatingSystem:'ChatGPT',isAccessibleForFree:true,publisher:{'@type':'Person',name:pluginEditor,email:pluginEmail}}]:[]),
    ]})}}/>
    <a className="business-plugin-skip" href="#plugin-content">Saltar al contenido</a>
    <header className="business-plugin-header">
      <a href="/" className="business-plugin-brand" aria-label="Xperiments, inicio">
        <img src="/logo.svg" width={695} height={258} alt="Xperiments" />
      </a>
      <a className="business-plugin-name" href={pluginPath}>Validación de negocios<span>Complemento para ChatGPT</span></a>
    </header>
    <nav className="business-plugin-nav" aria-label="Páginas de Validación de negocios">
      {pluginPages.map(page => <a key={page.path} href={page.path} aria-current={path === page.path ? 'page' : undefined}>{page.label}</a>)}
    </nav>
    <main id="plugin-content" className="business-plugin-main">
      <header className="business-plugin-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1><p>{intro}</p>
      </header>
      {children}
    </main>
    <footer className="business-plugin-footer">
      <p>Validación de negocios · Editor: {pluginEditor}</p>
      <a href={`mailto:${pluginEmail}`}>{pluginEmail}</a>
      <a href="/">Volver a Xperiments</a>
    </footer>
    <PublicSiteFooter/>
  </div>;
}
