import type { ReactNode } from 'react';
import { pluginEditor, pluginEmail, pluginPages, pluginPath } from './plugin-info';

export function PluginPage({ path, eyebrow, title, intro, children }: {
  path: string; eyebrow: string; title: string; intro: string; children: ReactNode;
}) {
  return <div className="business-plugin-site">
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
  </div>;
}
