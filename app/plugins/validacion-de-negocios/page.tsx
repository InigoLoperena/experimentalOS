import { MessageCircle, Compass, FlaskConical } from 'lucide-react';
import { PluginPage } from './plugin-page';
import { pluginEditor, pluginMetadata, pluginPath } from './plugin-info';

export const metadata = pluginMetadata('Presentación', 'Entrevistas con clientes, estrategia Go-To-Market y experimentación para contrastar propuestas de valor y modelos de negocio con ChatGPT.', pluginPath);

export default function BusinessValidationPlugin() {
  return <PluginPage path={pluginPath} eyebrow="TRES HABILIDADES · UN CICLO DE APRENDIZAJE" title="Validación de negocios"
    intro="Un complemento para ChatGPT que te ayuda a investigar problemas reales, definir una estrategia de mercado y diseñar experimentos para contrastar tu propuesta de valor y modelo de negocio.">
    <div className="business-plugin-badges" aria-label="Características"><span>Gratuito</span><span>Sin pagos ni compras</span><span>Para ideas y negocios en marcha</span></div>
    <section className="business-plugin-section" aria-labelledby="plugin-skills">
      <h2 id="plugin-skills">Tres habilidades para decidir con más fundamento</h2>
      <div className="business-plugin-cards">
        <article><MessageCircle size={28} aria-hidden="true" /><h3>Entrevistas con clientes</h3><p>Prepara preguntas sobre experiencias y comportamientos reales. Detecta preguntas que inducen respuestas y distingue opiniones, compromisos y evidencias.</p></article>
        <article><Compass size={28} aria-hidden="true" /><h3>Estrategia Go-To-Market</h3><p>Delimita el cliente inicial, las alternativas, la propuesta de valor, el posicionamiento y los canales. Señala qué decisiones necesitan más investigación.</p></article>
        <article><FlaskConical size={28} aria-hidden="true" /><h3>Experimentación</h3><p>Convierte supuestos en hipótesis y pruebas concretas. Define métricas, criterios de decisión y limitaciones antes de interpretar los resultados.</p></article>
      </div>
    </section>
    <section className="business-plugin-section"><h2>¿Para quién está pensado?</h2><p>Para emprendedores, fundadores, equipos de producto, profesionales de crecimiento y consultores que quieran contrastar una idea, mejorar una oferta o reducir la incertidumbre de un negocio. Puedes empezar con una descripción de tu proyecto y las preguntas que todavía no sabes responder.</p></section>
    <section className="business-plugin-section"><h2>Ejemplos de lo que puedes pedir</h2>
      <ul className="business-plugin-examples">
        <li>«Prepara una entrevista para comprender cómo resuelve hoy este problema mi cliente. Evita preguntarle si le gusta mi idea».</li>
        <li>«Compara estos segmentos y ayúdame a escoger un cliente inicial. Separa los datos de las suposiciones».</li>
        <li>«Propón un experimento económico para comprobar esta hipótesis, con métrica y criterio de éxito».</li>
        <li>«Revisa estos resultados y señala qué podemos concluir y qué sigue sin estar demostrado».</li>
      </ul>
    </section>
    <section className="business-plugin-section"><h2>Qué aporta y cuáles son sus límites</h2>
      <p>El complemento reúne instrucciones y referencias metodológicas. No sustituye las entrevistas, la investigación contrastada ni las pruebas con clientes. La IA puede equivocarse, omitir información o trabajar con datos desactualizados: comprueba las fuentes y revisa las propuestas antes de actuar.</p>
      <p>No garantiza ventas, financiación, rentabilidad ni éxito empresarial. No ejecuta campañas, compras o decisiones por ti. Sus referencias no implican que se distribuyan aquí libros completos ni materiales de terceros.</p>
      <p>La función «Revisar y guardar» prepara una ficha con el nombre, contexto, hipótesis, métrica y criterio de éxito que decidas enviar. También puede llevar dos variantes y una propuesta de campaña de Google Ads, Meta Ads o Smartlead. Recibirás un enlace cifrado que caduca a los 30 minutos. En Xperiments inicias sesión, eliges un proyecto y confirmas el guardado. Después revisas y confirmas el borrador del proveedor en la misma página. Google y Meta quedan pausados; Smartlead no envía correos. Los IDs confirmados se vinculan a tu ficha. El complemento no recibe tu contraseña ni consulta tus proyectos; tampoco copia automáticamente tus conversaciones o archivos.</p>
    </section>
    <section className="business-plugin-section business-plugin-callout"><h2>Información del complemento</h2>
      <p>Editor: <strong>{pluginEditor}</strong>, persona física. El complemento es gratuito y no incluye pagos ni compras. El acceso a ChatGPT, sus funciones y límites depende de las condiciones y del plan de cada usuario.</p>
      <p>Su disponibilidad se limita a los países permitidos por la plataforma. Esta página respalda su presentación para publicación; no confirma que esté publicado ni ofrece un enlace de instalación.</p>
      <a className="btn primary" href={`${pluginPath}/soporte`}>Contacto y soporte</a>
    </section>
  </PluginPage>;
}
