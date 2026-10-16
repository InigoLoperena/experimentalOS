import { PluginPage } from '../plugin-page';
import { pluginAddress, pluginEditor, pluginEmail, pluginMetadata, pluginPath, pluginUpdated, supportMailto } from '../plugin-info';

export const metadata = pluginMetadata('Privacidad', 'Privacidad del complemento Validación de negocios: ChatGPT, páginas informativas y atención por correo electrónico.', `${pluginPath}/privacidad`);

export default function PluginPrivacy() {
  return <PluginPage path={`${pluginPath}/privacidad`} eyebrow="PRIVACIDAD DEL COMPLEMENTO" title="Política de privacidad de Validación de negocios"
    intro="Esta política distingue el uso del complemento en ChatGPT, la visita a estas páginas informativas y el contacto con el editor. No sustituye la política general de Xperiments ni las políticas de OpenAI.">
    <p className="business-plugin-updated">Última actualización: {pluginUpdated}.</p>
    <section className="business-plugin-section"><h2>1. Editor y contacto</h2>
      <p><strong>{pluginEditor}</strong>, persona física residente en Argentina, es el editor del complemento y el responsable de los datos que recibe directamente para atender consultas de soporte.</p>
      <p>Domicilio de contacto: {pluginAddress}. Correo: <a href={`mailto:${pluginEmail}`}>{pluginEmail}</a>.</p>
    </section>
    <section className="business-plugin-section"><h2>2. Cuando utilizas el complemento en ChatGPT</h2>
      <p>Validación de negocios incluye instrucciones y referencias para entrevistas con clientes, estrategia Go-To-Market y experimentación. No incorpora un servidor propio, una base de datos del editor para tus conversaciones ni una integración que las envíe al editor. No hay sincronización automática con los proyectos o la memoria de Xperiments.</p>
      <p>El editor no recibe tus conversaciones a través de este complemento. Si decides enviar un extracto o captura por correo para pedir ayuda, ese material sí se recibe como parte de tu consulta de soporte.</p>
      <p>OpenAI procesa la información que introduces en ChatGPT, incluidos los mensajes y archivos, conforme a sus condiciones, tu configuración y las funciones que utilices. Eso no significa que nadie recopile datos. Consulta la <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer">política de privacidad de OpenAI</a> y los controles de datos de tu cuenta. La conservación, eliminación y posible uso de ese contenido por OpenAI no los decide el editor.</p>
    </section>
    <section className="business-plugin-section"><h2>3. Si escribes al soporte</h2>
      <p>Se reciben tu dirección de correo, el nombre que figure en el mensaje, su contenido, los adjuntos que elijas enviar y los datos técnicos habituales del correo. Facilitar esa información es voluntario; sin una dirección de respuesta o una descripción suficiente puede no ser posible atender la consulta.</p>
      <p>Se utiliza para responder dudas, investigar errores y atender solicitudes sobre datos. El buzón se gestiona con <strong>Namecheap</strong> y tiene acceso directo {pluginEditor}. No se utiliza otra herramienta de gestión de consultas. Namecheap procesa y almacena el correo para prestar ese servicio; consulta su <a href="https://www.namecheap.com/legal/general/privacy-policy/" target="_blank" rel="noopener noreferrer">política de privacidad</a>.</p>
      <p>Los correos y adjuntos de soporte se conservan durante <strong>un año desde la resolución de la consulta</strong>. Después se eliminan del buzón y de las copias bajo control del editor. Puedes solicitar su eliminación antes. Si fuera necesario conservar algún dato por una obligación legal o una reclamación, su conservación se limitará a esa finalidad y al tiempo necesario. Los plazos técnicos de copias de seguridad del proveedor se rigen por sus condiciones.</p>
      <p>No se utilizan los correos de soporte para enviar publicidad ni se incorporan automáticamente a la memoria de IA de Xperiments. Evita incluir datos sensibles o información de terceros que no sea necesaria para explicar el problema.</p>
    </section>
    <section className="business-plugin-section"><h2>4. Al visitar estas páginas</h2>
      <p>Estas cuatro páginas informativas se alojan en <strong>Vercel</strong>. La entrega de las páginas y la protección del servicio implican el tratamiento de datos técnicos de las solicitudes, como dirección IP, ruta solicitada, fecha, navegador y datos de errores o seguridad. La disponibilidad y conservación de esos registros dependen de la configuración y las políticas de Vercel; el plazo de un año del soporte no se aplica a los registros del alojamiento. Consulta la <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">política de privacidad de Vercel</a>.</p>
      <p>El código de estas páginas no incluye formularios de recogida de datos, rastreadores de visitas ni cookies de analítica o publicidad. No instala cookies propias ni guarda preferencias en el navegador. El enlace de correo abre tu aplicación de email; no transmite un formulario al sitio. El alojamiento puede aplicar medidas técnicas de seguridad según sus políticas.</p>
      <p>La aplicación principal Xperiments es un servicio separado: al iniciar sesión utiliza Supabase para autenticación y almacenamiento, y almacenamiento local del navegador para la sesión y preferencias. Sus funciones de IA envían a OpenAI el contexto necesario cuando se solicitan. PostHog está disponible como integración de experimentos; estas páginas del complemento no lo utilizan para medir visitas. Ese uso de la aplicación se describe en la <a href="/privacy-policy">política general de Xperiments</a>.</p>
    </section>
    <section className="business-plugin-section"><h2>5. Proveedores, seguridad y tratamiento internacional</h2>
      <p>Vercel y Namecheap prestan los servicios de alojamiento y correo descritos; OpenAI gestiona ChatGPT bajo sus propias condiciones. Sus infraestructuras pueden tratar información fuera de Argentina. Las prácticas y plazos de cada proveedor se consultan en las políticas enlazadas; esta página no promete que todos los datos permanezcan en un país concreto.</p>
      <p>Se limita el acceso del editor al soporte y se pide compartir solo la información necesaria. No existe una garantía absoluta de seguridad y la ausencia de un servidor propio del complemento no elimina el tratamiento realizado por los proveedores.</p>
    </section>
    <section className="business-plugin-section"><h2>6. Acceso, corrección y eliminación</h2>
      <p>Puedes solicitar acceso, rectificación, actualización o eliminación de los datos de soporte escribiendo a <a href={supportMailto('Privacidad · Validación de negocios')}>{pluginEmail}</a>. Indica la dirección desde la que contactaste y qué información quieres consultar o eliminar. Solo se solicitarán los datos necesarios para verificar la petición; no envíes documentación de identidad sin que se haya acordado un canal adecuado.</p>
      <p>Se atenderán las solicitudes conforme a la normativa aplicable. En Argentina puedes consultar tus derechos y presentar reclamos ante la <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noopener noreferrer">Agencia de Acceso a la Información Pública (AAIP)</a>. Para borrar conversaciones o datos de tu cuenta de ChatGPT, utiliza sus controles de datos o contacta con OpenAI; el editor no puede eliminarlos por ti.</p>
    </section>
    <section className="business-plugin-section"><h2>7. Cambios en esta política</h2><p>Las actualizaciones de esta política se publicarán en esta misma dirección con su fecha. Si cambia la configuración del complemento o se incorpora una integración externa, habrá que revisar esta información antes de utilizar ese nuevo flujo de datos.</p></section>
  </PluginPage>;
}
