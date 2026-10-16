import { PluginPage } from '../plugin-page';
import { pluginAddress, pluginEditor, pluginEmail, pluginMetadata, pluginPath, pluginUpdated } from '../plugin-info';

export const metadata = pluginMetadata('Términos', 'Condiciones de uso gratuito y límites del complemento Validación de negocios para ChatGPT.', `${pluginPath}/terminos`);

export default function PluginTerms() {
  return <PluginPage path={`${pluginPath}/terminos`} eyebrow="CONDICIONES DEL COMPLEMENTO" title="Términos de Validación de negocios"
    intro="Estas condiciones se refieren al complemento Validación de negocios para ChatGPT. No sustituyen las condiciones de OpenAI ni regulan las funciones independientes de la aplicación Xperiments.">
    <p className="business-plugin-updated">Última actualización: {pluginUpdated}.</p>
    <section className="business-plugin-section"><h2>1. Editor</h2><p>El editor es <strong>{pluginEditor}</strong>, persona física residente en Argentina. Domicilio de contacto: {pluginAddress}. Puedes contactar en <a href={`mailto:${pluginEmail}`}>{pluginEmail}</a>.</p></section>
    <section className="business-plugin-section"><h2>2. Servicio y gratuidad</h2>
      <p>El complemento aporta instrucciones y referencias para preparar entrevistas con clientes, desarrollar una estrategia Go-To-Market y diseñar experimentos. Es gratuito y no incluye pagos, compras ni contratación de servicios del editor.</p>
      <p>Su utilización requiere acceso a ChatGPT y está sujeta a las funciones, límites y países permitidos por la plataforma. Las condiciones o costes de tu cuenta de ChatGPT son independientes. Esta página no acredita la publicación del complemento ni constituye un enlace de instalación.</p>
    </section>
    <section className="business-plugin-section"><h2>3. Uso responsable</h2>
      <p>Utiliza el complemento de forma lícita, respetando los derechos de otras personas y las reglas de la plataforma. Comparte únicamente información que tengas derecho a utilizar y evita datos personales, secretos o materiales confidenciales innecesarios.</p>
      <p>No presentes entrevistas inventadas, opiniones de la IA ni estimaciones como resultados observados. Revisa las respuestas y contrasta las fuentes, cifras y conclusiones antes de tomar decisiones o compartirlas con terceros.</p>
    </section>
    <section className="business-plugin-section"><h2>4. Límites y ausencia de garantías empresariales</h2>
      <p>La IA puede producir errores o información incompleta o desactualizada. El complemento es una ayuda metodológica: no sustituye la investigación real, el criterio profesional ni el asesoramiento jurídico, fiscal o financiero cuando lo necesites.</p>
      <p>No se garantiza la validación de una idea, la captación de clientes, ventas, financiación, beneficios o cualquier otro resultado empresarial. Las decisiones, su ejecución y la revisión de las propuestas corresponden al usuario. El complemento no activa campañas, envía correos comerciales ni publica experimentos por sí mismo.</p>
    </section>
    <section className="business-plugin-section"><h2>5. Materiales y derechos de terceros</h2>
      <p>Los libros y demás materiales de referencia conservan los derechos de sus autores, editores y titulares. Su mención o utilización como referencia no otorga derechos para reproducirlos, distribuirlos o comercializarlos. Estas páginas no publican los libros completos.</p>
      <p>El usuario debe respetar las licencias y derechos aplicables a los materiales que aporte y a los contenidos que reutilice. No se afirma que los autores de las referencias patrocinen o avalen este complemento.</p>
    </section>
    <section className="business-plugin-section"><h2>6. Privacidad, soporte y plataforma</h2>
      <p>La función «Revisar y guardar» envía los campos del experimento al servidor de Xperiments y prepara un enlace cifrado válido durante 30 minutos. La preparación del enlace no confirma un guardado. Para guardar, debes iniciar sesión en Xperiments, disponer de un proyecto con permiso de creación y confirmar la ficha. El enlace no crea una cuenta, no concede permisos adicionales ni activa campañas. No lo compartas porque permite abrir el borrador. El tratamiento de datos se explica en la <a href={`${pluginPath}/privacidad`}>política específica de privacidad</a>. Las consultas al editor se atienden por <a href={`${pluginPath}/soporte`}>correo de soporte</a>, sin garantía de plazo de respuesta.</p>
      <p>Para preparar un borrador de campaña, se requieren además permisos de edición de experimentos y una conexión válida al proveedor en tu espacio. Revisa las variantes, la cuenta, los materiales y parámetros antes de confirmar el envío desde la web. La campaña y su ficha pueden quedar en estados diferentes si un paso falla: consulta los IDs y avisos antes de repetir. Google Ads y Meta Ads se crean pausados; Smartlead prepara las variantes sin enviar correos. No se afirma que una campaña con variantes sea un test A/B nativo, ni se implementan cambios en el código de tu producto. La activación y los costes futuros del proveedor corresponden a las decisiones que tomes allí.</p>
      <p>ChatGPT es un servicio de OpenAI. Su acceso y uso se rigen además por las <a href="https://openai.com/policies/terms-of-use/" target="_blank" rel="noopener noreferrer">condiciones de OpenAI</a> que correspondan al usuario. El editor no controla sus cuentas, disponibilidad o cambios de funcionamiento.</p>
    </section>
    <section className="business-plugin-section"><h2>7. Disponibilidad y actualizaciones</h2>
      <p>Las instrucciones, referencias o disponibilidad pueden cambiar. No se ofrece un compromiso de disponibilidad continua ni de mantenimiento durante un plazo determinado. Las revisiones de estas condiciones se publicarán aquí con su fecha.</p>
      <p>Estas condiciones no excluyen los derechos ni las responsabilidades que establezca obligatoriamente la normativa aplicable. No se impone una jurisdicción exclusiva ni una renuncia a derechos.</p>
    </section>
  </PluginPage>;
}
