import {PublicSiteShell} from '../../public-site-shell';
import {BlogEditor} from './editor';
export const metadata={title:'Administrar blog · Xperiments',robots:{index:false,follow:false}};
export default function BlogAdmin(){return <PublicSiteShell><main id="contenido" className="blog-page blog-admin"><h1>Administrar blog</h1><BlogEditor/></main></PublicSiteShell>;}
