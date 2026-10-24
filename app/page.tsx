import { ArrowRight, BrainCircuit, Check, FlaskConical, Lightbulb, BookOpen, Link2, ShieldCheck } from 'lucide-react';
import { PublicSiteShell } from './public-site-shell';
import { LegacyAuthBridge } from './legacy-auth-bridge';
import { productCapabilities, productDefinition, productFaqs, productSteps } from '@/lib/product-content';
import { SITE_URL, jsonLd, publicMetadata } from '@/lib/public-site';

const pageMetadata=publicMetadata({title:'Xperiments · Experimentos de negocio con IA',description:'Diseña experimentos con IA, conecta tus herramientas y transforma resultados en aprendizajes para validar tu propuesta de valor y modelo de negocio.',path:'/'});
export const metadata={...pageMetadata,alternates:{...pageMetadata.alternates,types:{'text/markdown':'/producto.md'}}};
const icons={hypothesis:Lightbulb,ai:BrainCircuit,learning:BookOpen};

export default function LandingPage() {
 const graph={ '@context':'https://schema.org','@graph':[
  {'@type':'Person','@id':`${SITE_URL}/#editor`,name:'Iñigo Loperena',url:SITE_URL,email:'hello@xperiments.site'},
  {'@type':'WebSite','@id':`${SITE_URL}/#website`,name:'Xperiments',url:SITE_URL,inLanguage:'es',publisher:{'@id':`${SITE_URL}/#editor`}},
  {'@type':'SoftwareApplication','@id':`${SITE_URL}/#software`,name:'Xperiments',url:SITE_URL,description:productDefinition,applicationCategory:'BusinessApplication',operatingSystem:'Web',inLanguage:'es',image:`${SITE_URL}/opengraph-image`,publisher:{'@id':`${SITE_URL}/#editor`},featureList:['Proyectos e hipótesis','Preparación de experimentos con IA','Conexiones con herramientas externas','Resultados y aprendizajes','Memoria privada por espacio de trabajo']},
  {'@type':'FAQPage',mainEntity:productFaqs.map(faq=>({'@type':'Question',name:faq.question,acceptedAnswer:{'@type':'Answer',text:faq.answer}}))},
 ]};
 return <PublicSiteShell>
  <LegacyAuthBridge/>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(graph)}}/>
  <main id="contenido" className="public-main">
   <section className="landing-hero" aria-labelledby="landing-title">
    <div className="landing-hero-copy">
     <p className="public-eyebrow"><span aria-hidden="true"/> EXPERIMENTAL INNOVATION OS</p>
     <h1 id="landing-title">Diseña experimentos con IA.<br/><span>Aprende con cada prueba.</span></h1>
     <p className="landing-definition">{productDefinition}</p>
     <div className="public-actions"><a href="/proyectos" className="public-button">Entrar a mi espacio <ArrowRight size={18} aria-hidden="true"/></a><a href="mailto:hello@xperiments.site?subject=Acceso%20a%20Xperiments" className="public-text-link">Solicitar acceso</a></div>
     <p className="public-caption">Piloto privado · Equipos por invitación · Tú revisas las decisiones</p>
    </div>
    <div className="experiment-preview" aria-label="Ejemplo ilustrativo del flujo de un experimento">
     <div className="preview-window-bar"><span className="preview-window-dots" aria-hidden="true">● ● ●</span><span>UN EJEMPLO, DE PRINCIPIO A FIN</span></div>
     <div className="preview-project"><span className="preview-project-icon"><FlaskConical size={25} aria-hidden="true"/></span><div><small>EXPERIMENTO</small><h2>¿Qué propuesta conecta mejor?</h2></div><span className="preview-status">Por validar</span></div>
     <div className="preview-hypothesis"><span><Lightbulb size={16} aria-hidden="true"/> HIPÓTESIS</span><p>Un beneficio concreto generará más interés que una lista de funciones.</p></div>
     <div className="preview-variants"><div><span>A</span><p>Una tarea resuelta.<br/><strong>Menos tiempo perdido.</strong></p></div><div><span>B</span><p>Todas las funciones.<br/><strong>Más posibilidades.</strong></p></div></div>
     <div className="preview-metric"><span>Métrica principal</span><strong>Solicitudes de una demo</strong></div>
     <div className="preview-learning"><BrainCircuit size={24} aria-hidden="true"/><p>El resultado se documenta.<br/><strong>La siguiente prueba parte de lo aprendido.</strong></p></div>
    </div>
   </section>
   <section className="landing-flow" aria-label="Ciclo de experimentación"><span>Investiga</span><ArrowRight aria-hidden="true" size={16}/><span>Formula hipótesis</span><ArrowRight aria-hidden="true" size={16}/><span>Experimenta</span><ArrowRight aria-hidden="true" size={16}/><span>Mide</span><ArrowRight aria-hidden="true" size={16}/><strong>Aprende</strong></section>
   <section className="landing-section" aria-labelledby="value-heading">
    <div className="landing-section-heading"><p className="public-eyebrow">DEL CONTEXTO A LA DECISIÓN</p><h2 id="value-heading">Todo el recorrido.<br/><span>Una memoria compartida.</span></h2><p>La información tiene más valor cuando puedes relacionar lo que creías, lo que probaste y lo que ocurrió.</p></div>
    <div className="landing-feature-grid">{productCapabilities.map(item=>{const Icon=icons[item.icon];return <article className="landing-feature" key={item.title}><Icon size={28} aria-hidden="true"/><h3>{item.title}</h3><p>{item.description}</p></article>;})}</div>
   </section>
   <section className="landing-section landing-how" id="como-funciona" aria-labelledby="how-heading"><div className="landing-section-heading"><p className="public-eyebrow">UN SISTEMA SENCILLO</p><h2 id="how-heading">Haz mejores preguntas.<br/><span>Diseña mejores pruebas.</span></h2></div><ol className="landing-steps">{productSteps.map(step=><li key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></section>
   <section className="landing-section landing-memory" aria-labelledby="memory-heading"><div className="landing-section-heading"><p className="public-eyebrow">LA IA / TU EQUIPO</p><h2 id="memory-heading">Cada experimento deja<br/><span>algo que puedes reutilizar.</span></h2><p>La IA recupera el contexto autorizado de los proyectos y los aprendizajes del espacio. No necesita entrenar un modelo nuevo: necesita evidencia útil y bien organizada.</p><a className="public-text-link" href="/guia-investigacion">Cómo investigar e importar contexto <ArrowRight size={16} aria-hidden="true"/></a></div><ul className="landing-memory-list"><li><BrainCircuit size={22} aria-hidden="true"/><div><strong>Metodología + contexto</strong><p>Conocimiento general y memoria privada del equipo, con funciones distintas.</p></div></li><li><ShieldCheck size={22} aria-hidden="true"/><div><strong>Cada espacio, sus datos</strong><p>Permisos y separación de acceso entre equipos. Consulta los detalles en la política de privacidad.</p></div></li><li><Check size={22} aria-hidden="true"/><div><strong>Hipótesis con revisión humana</strong><p>La IA propone; el equipo contrasta y valida. Una recomendación no demuestra un resultado.</p></div></li></ul></section>
   <section className="landing-integrations" aria-labelledby="integrations-heading"><Link2 size={24} aria-hidden="true"/><div><h2 id="integrations-heading">Tus herramientas siguen siendo tus herramientas.</h2><p>Conecta servicios como Meta Ads, Google Ads, Metricool, Smartlead o PostHog. La preparación y lectura de datos dependen de las capacidades y permisos de cada API. Las campañas publicitarias se activan manualmente.</p></div></section>
   <section className="landing-section landing-faq" aria-labelledby="faq-heading"><div className="landing-section-heading"><p className="public-eyebrow">ANTES DE EMPEZAR</p><h2 id="faq-heading">Preguntas frecuentes</h2></div><div>{productFaqs.map(faq=><details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
   <section className="landing-final"><FlaskConical size={30} aria-hidden="true"/><h2>La siguiente decisión empieza<br/>con una buena pregunta.</h2><p>Organiza lo que sabes. Prueba lo que importa. Conserva lo que aprendes.</p><a href="/proyectos" className="public-button">Acceder a Xperiments <ArrowRight size={18} aria-hidden="true"/></a></section>
  </main>
 </PublicSiteShell>;
}
