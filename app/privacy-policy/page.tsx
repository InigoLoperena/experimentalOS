import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · Xperiments",
  description: "Tratamiento de datos, integraciones y derechos de privacidad en Xperiments.",
};

export default function PrivacyPolicy() {
  return (
    <main className="privacy-page">
      <a href="/">← Volver a Xperiments</a>
      <h1>Política de privacidad</h1>
      <p>Última actualización: 12 de octubre de 2026.</p>
      <p>Esta política describe el uso de datos en Xperiments (Experimental OS), una herramienta para preparar, monitorizar y documentar experimentos. El servicio es gestionado por Imagine Builder. Para consultas sobre privacidad, escribe a <a href="mailto:hello@greenhunt.net">hello@greenhunt.net</a>.</p>

      <h2>Datos que tratamos</h2>
      <p>Tratamos los datos de cuenta y perfil que facilitas, tu pertenencia al equipo y permisos, y los proyectos, hipótesis, experimentos, resultados, aprendizajes y archivos que introduces. También tratamos la configuración y credenciales de las integraciones que autorizas, sus identificadores y las métricas que solicitas importar. Los servicios de alojamiento pueden registrar datos técnicos de solicitudes, como dirección IP y errores, para operar y proteger el servicio.</p>

      <h2>Para qué los utilizamos</h2>
      <p>Utilizamos estos datos para autenticar usuarios, aplicar permisos, guardar tu trabajo, preparar experimentos, recuperar resultados de herramientas conectadas y resolver incidencias. Las funciones opcionales de IA e integraciones se ejecutan cuando las utilizas o autorizas. No vendemos tus datos ni los utilizamos para publicidad dirigida de terceros.</p>

      <h2>Integración con Meta: Facebook e Instagram</h2>
      <p>Cuando conectas Meta Ads, usamos los permisos concedidos para consultar las cuentas y activos autorizados, obtener campañas y estadísticas y preparar campañas, conjuntos, creatividades y anuncios. Los textos, imágenes, vídeos y parámetros que envías a Meta se comparten con Meta para crear esos recursos. Xperiments crea los recursos publicitarios en estado pausado; su activación se realiza manualmente en Meta. La información importada queda asociada al proyecto y equipo correspondientes.</p>
      <p>Solo accedemos a los activos que autorices. Puedes revocar el acceso desde las herramientas de Meta o desconectar la integración en Xperiments. La revocación impide futuras consultas con esas credenciales; no elimina por sí misma campañas de Meta ni resultados que ya se hayan importado.</p>

      <h2>Asistente de inteligencia artificial</h2>
      <p>Al solicitar una propuesta, enviamos a OpenAI tu solicitud y el contexto necesario del proyecto, junto con las imágenes o fotogramas seleccionados para ese análisis. La aplicación solicita que la respuesta no se almacene como historial en la API (store: false); los registros y plazos propios del proveedor dependen de sus condiciones. Las propuestas requieren revisión humana. Evita incluir datos sensibles o de terceros que no tengas autorización para compartir.</p>

      <h2>Proveedores y otras integraciones</h2>
      <p>Supabase proporciona la base de datos, autenticación y almacenamiento; Vercel aloja la aplicación; OpenAI procesa las solicitudes de IA. Las herramientas que conectes, como Meta o PostHog, reciben los datos necesarios para las operaciones que solicites. El tratamiento por esos proveedores se rige también por sus políticas. Según la ubicación de sus servicios, puede implicar procesamiento fuera de tu país.</p>

      <h2>Acceso y seguridad</h2>
      <p>El acceso a proyectos y adjuntos está limitado por el equipo y sus permisos. Las credenciales de integración se guardan cifradas y se utilizan desde el servidor. Tu administrador puede gestionar los accesos del equipo. Aplicamos controles técnicos para proteger los datos, aunque ningún sistema garantiza seguridad absoluta.</p>

      <h2>Almacenamiento local y sesión</h2>
      <p>La aplicación utiliza almacenamiento del navegador para mantener la sesión y recordar preferencias, como el equipo seleccionado. Las plataformas externas que abras pueden utilizar sus propias cookies según sus políticas.</p>

      <h2>Conservación y eliminación</h2>
      <p>Conservamos la información mientras sea necesaria para prestar el servicio y mantener los proyectos del equipo. Puedes eliminar registros mediante las funciones disponibles o solicitar la eliminación de tu cuenta y datos escribiendo al contacto indicado. Los datos compartidos del equipo requieren comprobar los permisos y derechos de los demás miembros. Los respaldos y registros técnicos pueden conservarse temporalmente según los plazos operativos de los proveedores y las obligaciones aplicables.</p>
      <p>Para solicitar la eliminación de datos obtenidos de Meta, escribe a <a href="mailto:hello@greenhunt.net?subject=Eliminaci%C3%B3n%20de%20datos%20Meta%20en%20Xperiments">hello@greenhunt.net</a> indicando el correo de tu cuenta, equipo y que solicitas eliminar los datos de Meta. Verificaremos tu identidad y el alcance antes de tramitarla. No envíes contraseñas ni tokens. Eliminar datos de Xperiments no elimina los recursos de tu cuenta de Meta.</p>

      <h2>Tus derechos y cambios</h2>
      <p>Puedes solicitar acceso, corrección, eliminación o una copia de tus datos, y plantear restricciones u objeciones al tratamiento según la normativa aplicable. También puedes revocar permisos de las integraciones. Contacta con hello@greenhunt.net para ejercer estos derechos o resolver dudas. Publicaremos aquí los cambios de esta política con su fecha de actualización.</p>
    </main>
  );
}
