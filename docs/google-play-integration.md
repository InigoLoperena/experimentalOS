# Google Play: alcance verificado

Revisado el 12 de octubre de 2026. Cuenta Imagine builder, sin aplicaciones; Play Console exige verificar el teléfono antes de crear la primera. No se crearon apps, credenciales ni permisos.

## Distinción entre APIs

- Android Publisher API administra versiones, fichas localizadas, imágenes y otras operaciones mediante edits. Modificar una ficha no crea un test A/B. Crear edits puede interferir con trabajo en curso; no se usa como comprobación de lectura.
- Play Developer Reporting API proporciona Android Vitals: estabilidad, errores, ANR, rendimiento. No proporciona resultados A/B de fichas.
- Los catálogos públicos de ambas APIs no exponen creación ni lectura por variante de Store Listing Experiments. No se ofrecen endpoints inventados, scraping privado ni automatización del navegador como integración del SaaS.

## Implementado

Canal google_play con tipo gráfico/localizado, idioma, elemento, métrica y audiencia experimental en execution_config existente. IA propone la configuración, pregunta por datos desconocidos y genera una o dos variantes nuevas. La ficha actual es el control. Google distribuye la audiencia experimental entre las variantes; allocation de la app no se envía a Google.

Se valida configuración, límite de descripciones (80/4000), material asignado y máximo dos variantes nuevas antes de descargar una guía de texto local. No es un payload ni un archivo importable por Play Console. Los originales permanecen en adjuntos privados; nombres de materiales no implican validación de formato o disponibilidad de esos archivos.

Se reutilizan recursos, variantes y observaciones existentes con proveedor other (Otra plataforma), sin modificar enums ni RLS. Un recurso por variante y otro para el control; IDs locales sugeridos EXP-…-PLAY-1/2, URL real de Console opcional. El usuario importa recuentos y periodos manualmente o mediante la plantilla CSV de Experiments, después de vincular cada recurso a una variante. No se importa automáticamente un CSV nativo de Google. La conclusión y sus intervalos se documentan en aprendizajes; no se calcula ni inventa significancia.

## Pendiente y límites

No hay conexión API real a Google Play, sincronización automática, envío de fichas ni publicación. Se conserva la configuración privada de cuenta de servicio existente para futuras operaciones específicas; no se solicita un secreto sin una función API que lo necesite. No hay prueba real de test A/B porque no existe aplicación publicada. Apple se abordará por separado, comprobando su API antes de reutilizar este alcance.

## Fuentes oficiales

- https://developers.google.com/android-publisher/api-ref/rest
- https://developers.google.com/android-publisher/api-ref/rest/v3/edits.listings
- https://developers.google.com/play/developer/reporting/reference/rest
- https://support.google.com/googleplay/android-developer/answer/12053285
- https://support.google.com/googleplay/android-developer/answer/9859152

## Validación

Pruebas de control frente a variantes nuevas, IDs locales distintos, límite de texto, datos desconocidos conservados, audiencia inválida y separación entre gráficos y descripciones. Typecheck/build y suite existente antes de sincronizar con GitHub. No se requieren migraciones.
