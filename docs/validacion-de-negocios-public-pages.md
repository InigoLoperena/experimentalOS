# Páginas públicas de Validación de negocios

Revisión: 16 de octubre de 2026. Estas páginas corresponden al complemento de ChatGPT, no a la IA de los espacios de Xperiments.

## Alcance y datos confirmados por el editor

- Editor: Iñigo Loperena, persona física, residente en Argentina. El domicilio de contacto publicado fue facilitado y autorizado expresamente por el editor.
- Contacto y soporte: hello@xperiments.site, buzón gestionado con Namecheap. Solo el editor tiene acceso directo; no utiliza otra herramienta para consultas.
- Conservación del soporte: un año desde la resolución. El editor confirmó que atiende acceso/eliminación por ese correo y puede borrar los mensajes y archivos bajo su control.
- Complemento gratuito, sin pagos ni compras, con tres habilidades y referencias. No tiene servidor propio ni conexión que envíe conversaciones al editor. No se presume publicado ni se proporciona un enlace de instalación.
- No se publican libros, investigaciones privadas ni documentos importados en los espacios.

## Inspección del sitio

- `app/layout.tsx` carga estilos y metadatos, sin scripts de analítica. No hay SDK de analítica de visitas en `package.json`, ni inicialización de PostHog, Google Analytics, píxel de Meta o Vercel Analytics en el código de interfaz revisado.
- PostHog se utiliza en endpoints e interfaces de integración para experimentos autorizados; no se confunde con seguimiento de visitantes.
- `lib/supabase.ts` inicializa el cliente de la aplicación principal; el SDK mantiene su sesión por defecto en almacenamiento local. `app/page.tsx` recuerda el workspace por usuario. La aplicación tiene formularios de cuenta/perfil, registros, comentarios, importaciones y conexiones; no son formularios del complemento.
- La aplicación utiliza Supabase para autenticación/datos/archivos y OpenAI para solicitudes explícitas de IA, voz y preparación. Las APIs de proveedores se ejecutan en sus respectivos flujos autorizados.
- Las cuatro rutas nuevas son componentes de servidor estáticos: no importan el cliente Supabase, formularios, scripts de analítica, archivos de libros ni código de IA. Solo recursos locales y enlaces de navegación o `mailto:`. No añaden cookies ni almacenamiento local.
- Vercel aloja el sitio y puede procesar registros técnicos y de seguridad. La retención visible de logs de funciones no se presenta como garantía de eliminación de todos los registros de infraestructura. Los plazos del correo no se extienden a esos logs ni a ChatGPT.
- No se modifica la política general de Xperiments, su autenticación, analítica ni las integraciones existentes.

## Fuentes públicas revisadas

- Ley argentina 25.326, identificación del responsable y derechos: https://www.argentina.gob.ar/normativa/nacional/64790/texto
- AAIP, derechos: https://www.argentina.gob.ar/aaip/datospersonales/derechos
- OpenAI, privacidad: https://openai.com/policies/privacy-policy/
- Namecheap, privacidad: https://www.namecheap.com/legal/general/privacy-policy/
- Vercel, privacidad y registros: https://vercel.com/legal/privacy-policy y https://vercel.com/docs/logs/runtime

Los textos no afirman certificación jurídica, protección absoluta, ausencia de recopilación por terceros ni una jurisdicción exclusiva. Las transferencias internacionales se describen sin inventar ubicaciones o garantías contractuales que no se hayan verificado.

## Verificación de publicación

Validación local completada: 194 pruebas aprobadas, TypeScript y compilación de producción correctos. Las cuatro rutas responden 200 sin cookies ni cabeceras de autenticación, en acceso directo y recarga; se verificaron metadatos canónicos, navegación, contacto `mailto:`, ausencia de formularios, rastreadores y enlaces a PDF de libros. No se reciben cabeceras Set-Cookie en estas respuestas.

Revisión visual en Chrome: presentación de escritorio, navegación entre las cuatro páginas y recarga. A 390 px, las tarjetas pasan a una columna y ninguna página desborda horizontalmente. Se comprueba de nuevo el acceso anónimo de las cuatro URLs en producción después del despliegue. El enlace de correo se verifica sin enviar mensajes de prueba.
