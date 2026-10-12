# Metricool: integración y acceso pendiente

## Estado verificado el 12 de octubre de 2026

La ficha simplificada está publicada en el commit bc4d0a6. La marca Metricool greenhuntstoopingapp tiene userId 5189018 y blogId 6744178, zona Europe/Madrid y Facebook, Instagram, TikTok y YouTube conectados. Su pestaña Ajustes → API muestra «Acceso API — Planes Advanced y Custom» y «Actualiza tu plan»: no ofrece un token. No se ha contratado ni cambiado ningún plan.

El conector de ChatGPT pudo leer la marca y la lista de publicaciones programadas (vacía entre 12–19 octubre). Esta conexión no proporciona una credencial al backend de Experimental OS.

## Implementado

- Conexión por proyecto mediante token cifrado del panel Integraciones existente. Solo el superadministrador puede configurarla.
- Comprobar la marca y redes accesibles con el token; las consultas usan el JWT del usuario y las políticas RLS existentes.
- Lectura de publicaciones publicadas, selección de red y rango máximo de 31 días.
- Preparar el vínculo con una variante y revisar/importar métricas a través del módulo de resultados existente.
- IDs publicados con prefijo de red (`instagram:123`, `tiktok:123`), evitando colisiones entre redes.
- Métricas faltantes no se convierten en cero. No se importan los campos de Instagram marcados como obsoletos en el catálogo consultado.
- Acumulados identificados como snapshots; el rango selecciona publicaciones por su fecha de publicación, no un periodo de atribución de sus interacciones.
- Host y endpoints fijos, token solo en cabecera, sin redirecciones ni seguimiento de enlaces de paginación no verificados. Si aparecen más páginas, la importación falla explícitamente y pide reducir el rango.

## Creación de borradores: siguiente tramo, pendiente de acceso API

La preferencia aprobada es crear borradores y revisar/programar manualmente en Metricool. No hay un botón activo de creación ni se ha creado/programado ninguna publicación.

1. Obtener y guardar el token en Integraciones → Metricool → Greenhunt y comprobar la marca.
2. Probar en esa cuenta los endpoints de transferencia de adjuntos privados: `PUT /v2/media/s3/upload-transactions`, subir partes y `PATCH` para completar. El Swagger documenta hash SHA-256 en base64, rangos de bytes y formatos SIMPLE/MULTIPART. Mantener privadas las copias de Supabase; nunca convertir su bucket en público.
3. Añadir configuración de redes, formato, fechas orientativas por variante y opciones obligatorias por red al formulario del canal Metricool. La IA propone contenido; el usuario revisa variantes y materiales.
4. Crear un recibo persistente por experimento/variante/red, ligado a revisión de la ficha, conexión y material; reservarlo antes del envío. No repetir automáticamente una creación con resultado incierto. Si una variante se crea y otra falla, conservar el ID exitoso y reanudar solo la pendiente.
5. Crear un recurso por variante y red con `POST /v2/scheduler/posts`, `draft: true`, sin habilitar publicación automática; leerlo nuevamente y comprobar estado DRAFT. Guardar scheduler ID y después los IDs/publicUrl de cada proveedor cuando se publique.
6. Ofrecer selección de publicaciones programadas existentes mediante `GET /v2/scheduler/posts` y asociar scheduler ID por separado del ID final de la red. No reconocer publicaciones por similitud del texto.
7. Validar con dos borradores de prueba, revisar sus imágenes/vídeos en Metricool, publicar manualmente solo cuando el usuario lo decida y comprobar la recuperación de métricas por ID exacto.

Dos publicaciones orgánicas comparadas son un experimento comparativo; no implican asignación aleatoria 50/50. No agregar resultados de distintas redes ni acumulados repetidos como si fueran muestras independientes.

## Fuentes primarias y discrepancias

- https://app.metricool.com/resources/apidocs/index.html
- https://app.metricool.com/api/swagger.json
- https://help.metricool.com/basic-guide-for-api-integration-r97af
- https://help.metricool.com/api-limitations-per-social-network-n7zlr

La guía simplificada menciona mediaId; el Swagger actual define `ScheduledPost.media` como array de strings y documenta transferencia S3. Se usará el contrato verificado con respuestas reales antes de activar creación con adjuntos. El antiguo `/stats/youtube/videos` está obsoleto y remite a `/v2/analytics/posts/youtube`; este último no aparece como operación completa en el Swagger descargado. La lectura de YouTube necesita verificación real, y no se certifica todavía. No se supone que todas las opciones del editor web sean publicables mediante API.
