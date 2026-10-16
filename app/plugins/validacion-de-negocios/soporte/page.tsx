import { PluginPage } from '../plugin-page';
import { pluginEmail, pluginMetadata, pluginPath, supportMailto } from '../plugin-info';

export const metadata = pluginMetadata('Soporte', 'Contacto para dudas, errores y sugerencias del complemento Validación de negocios para ChatGPT.', `${pluginPath}/soporte`);

export default function PluginSupport() {
  return <PluginPage path={`${pluginPath}/soporte`} eyebrow="AYUDA Y CONTACTO" title="Soporte de Validación de negocios"
    intro="Puedes comunicar dudas sobre las habilidades, errores en las referencias o problemas al utilizar el complemento.">
    <section className="business-plugin-section business-plugin-callout"><h2>Escribe al editor</h2>
      <p><a className="business-plugin-email" href={supportMailto('Soporte · Validación de negocios')}>{pluginEmail}</a></p>
      <p>El enlace abre tu aplicación de correo. Puedes escribir también copiando la dirección. No necesitas crear una cuenta en Xperiments y esta página no envía formularios.</p>
    </section>
    <section className="business-plugin-section"><h2>Cómo comunicar una incidencia</h2><ol>
      <li>Indica que consultas sobre «Validación de negocios» y qué habilidad estabas utilizando.</li>
      <li>Describe qué intentabas hacer, qué ocurrió y qué esperabas obtener.</li>
      <li>Si es útil, añade los pasos para reproducirlo, la fecha aproximada y una captura o un ejemplo breve sin datos personales ni información confidencial.</li>
    </ol><p>No envíes contraseñas, claves API, documentos de identidad ni conversaciones completas con datos de clientes. No se garantizan plazos de respuesta.</p></section>
    <section className="business-plugin-section"><h2>Privacidad y acceso a ChatGPT</h2>
      <p>La misma dirección atiende solicitudes sobre tus datos de soporte. Consulta la <a href={`${pluginPath}/privacidad`}>privacidad específica del complemento</a> para conocer el tratamiento y la conservación de esos correos.</p>
      <p>Las incidencias de tu cuenta, suscripción o funcionamiento general de ChatGPT se gestionan con <a href="https://help.openai.com/" target="_blank" rel="noopener noreferrer">el soporte de OpenAI</a>. El editor no tiene acceso administrativo a tu cuenta ni puede borrar tu historial de ChatGPT.</p>
    </section>
  </PluginPage>;
}
