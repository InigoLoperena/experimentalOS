import type { ReactNode } from 'react';
import './public-site.css';

export function PublicSiteFooter() {
 return <footer className="public-footer">
  <div><a href="/" className="public-footer-brand">Xperiments</a><p>Experimenta con intención. Conserva lo aprendido.</p><small>Editor: Iñigo Loperena · <a href="mailto:hello@xperiments.site">hello@xperiments.site</a></small></div>
  <nav aria-label="Enlaces públicos"><a href="/blog">Blog</a><a href="/guia-investigacion">Guía de investigación</a><a href="/agentes">Para agentes</a><a href="/plugins/validacion-de-negocios">Validación de negocios</a><a href="/privacy-policy">Privacidad</a></nav>
 </footer>;
}

export function PublicSiteShell({ children }: { children: ReactNode }) {
 return <div className="public-site">
  <a className="public-skip-link" href="#contenido">Saltar al contenido</a>
  <header className="public-header">
   <a className="public-brand" href="/" aria-label="Xperiments, inicio"><img src="/logo.svg?v=light-blue-20261024" alt="Xperiments" width={210} height={72}/></a>
   <nav aria-label="Navegación pública"><a href="/#como-funciona">Cómo funciona</a><a href="/blog">Blog</a><a href="/guia-investigacion">Recursos</a><a className="public-button public-button-small" href="/proyectos">Acceder <span aria-hidden="true">↗</span></a></nav>
  </header>
  {children}
  <PublicSiteFooter/>
 </div>;
}
