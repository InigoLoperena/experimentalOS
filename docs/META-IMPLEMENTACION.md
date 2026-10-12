# Meta Ads: preparación revisada y resultados

La aplicación trabaja en local y se sincroniza con `InigoLoperena/experimentalOS`. Se conservan los cambios de marca y registro introducidos en GitHub hasta `06bcdd7`.

## Flujo implementado

1. En la ficha, seleccionar Meta Ads y describir el experimento con imágenes o vídeos. OpenAI Responses devuelve una propuesta estructurada, preguntas y recomendaciones; las respuestas permiten mejorarla sin guardar todavía la ficha.
2. Revisar objetivo, público, duración, presupuesto diario total, variantes, textos, CTA y criterio de éxito. La IA propone nombres exactos de materiales por variante; asignaciones ambiguas requieren elección manual. Guardar conserva los originales privados y las variantes existentes.
3. En preparación de Meta, elegir campaña nueva, conjuntos en una campaña pausada existente o un anuncio en un conjunto pausado. Buscar ciudad en Meta o indicar países; confirmar edades y ubicaciones reales. La descripción de intereses de la ficha no se convierte silenciosamente en segmentación.
4. Asignar material por variante y ubicación. Se crean copias JPG de imágenes/portadas a 1440×1800 (Feed) y 1440×2560 (Stories/Reels), con recorte centrado, por contenido, superior o inferior. Estas son decisiones de formato de esta aplicación, no mínimos universales de Meta. Se muestran las copias antes de aprobar. Ampliar no recupera detalle.
5. Confirmar revisión, recortes, cuenta y presupuesto; enviar materiales y crear recursos PAUSED. Meta procesa los vídeos MP4 originales; no se recorta vídeo ni se cambia audio. Cada vídeo requiere una imagen de portada privada. Límite propio: 10 MB por archivo.
6. Revisar y publicar manualmente en Ads Manager. No existe un endpoint de activación.
7. Consultar resultados de campañas, conjuntos o anuncios vinculados, revisar la importación y guardar. Se conservan IDs y relaciones de variantes para no registrar dos veces el experimento.

## Límites y comportamiento

- Lectura independiente del objetivo: impresiones, clics, alcance, gasto, acciones, valores de acciones y visualizaciones de vídeo al 25/50/75/100%, cuando Meta los devuelva. Cada `action_type` tiene una métrica independiente, fuente y periodo. Los aliases de conversiones no se suman; la ausencia de datos no se interpreta como cero. Se utiliza la atribución predeterminada de Meta y `action_report_time=conversion`.
- Preparación: tráfico web, alcance, interacción con el anuncio, leads web y ventas web. Leads/ventas requieren píxel accesible y evento elegido; acceso al píxel no demuestra que ese evento esté correctamente instrumentado. Instalaciones, catálogos, formularios instantáneos, mensajes y categorías especiales precisan preparación específica y no se prometen como operaciones automáticas disponibles.
- Página y cuenta de Instagram se configuran por proyecto. El botón de consulta recupera la cuenta profesional vinculada a la página y los píxeles accesibles si el token tiene los permisos necesarios. No se inventan IDs ni se usan cuentas de otro proyecto.
- Se crea un conjunto por variante y ubicación (Facebook e Instagram comparten el grupo Feed/Stories/Reels). El presupuesto se guarda como `lifetime_budget`: presupuesto diario de referencia × duración, distribuido entre variantes según porcentajes y a partes iguales entre ubicaciones. El ritmo diario depende de Meta. Monedas preparadas: USD/EUR/GBP, en unidades mínimas de dos decimales. Meta puede exigir mínimos mayores. Se muestra todo antes de aprobar.
- Esta comparación de variantes no es una asignación A/B aleatoria. Un experimento causal necesita un diseño específico de exclusión/asignación y potencia estadística.
- Cada llamada realiza un paso y guarda su recibo. `pending` o `uncertain` impide repetir automáticamente; hay que reconciliar el recurso en Meta. `rejected` puede reintentarse expresamente; `succeeded` se reutiliza. Un cambio de ficha, integración o materiales invalida la aprobación anterior. Las operaciones nuevas no reutilizan silenciosamente un contenedor piloto.
- Las tablas `meta_preparation_runs` y `meta_preparation_steps` tienen RLS de lectura por equipo y escrituras limitadas mediante funciones que verifican permiso `experiments.edit`. No contienen tokens. Los secretos permanecen cifrados en la conexión por proyecto.
- La selección y recibos pertenecen a un workspace/proyecto/experimento; los recursos campaña/conjunto/anuncio se vinculan automáticamente. Los originales siguen en Storage privado bajo JWT del usuario. Las miniaturas de revisión no se almacenan públicamente.

## Validación y configuración real

Las pruebas cubren construcción de parámetros, reparto de presupuesto, privacidad, recortes, carga multipart MP4, espera de procesamiento, fallos ambiguos, IDs, permisos/RLS y recuperación. Las respuestas externas de estas pruebas son simuladas: no demuestran por sí solas aceptación de todos los objetivos por una cuenta real.

La migración `20261012123718_meta_complete_preparation` está aplicada y verificada en Supabase: ambas tablas nuevas tienen RLS y se conservaron los 17 registros y el recurso externo existentes. Se recuperó también en el repositorio la migración de permisos `20261011223742` que ya estaba aplicada. El registro de equipos introducido por los cambios recientes es idempotente y nunca añade automáticamente usuarios a Imagine Builder. La copia exportable incluye recibos y configuración pública de integraciones; las claves no se exportan.

La cuenta piloto de Greenhunt tiene una campaña vacía previamente verificada PAUSED. Antes de probar anuncios reales deben completarse el ID y permisos de Instagram, aportar creatividades aprobadas y confirmar la preparación concreta en la aplicación. Se identificó en Meta @greenhuntstoopingapp, ID `17841449040284665`; el usuario de integración actualmente solo tiene activos de app y cuenta publicitaria, pendientes página e Instagram. El usuario aclaró que las pruebas de píxel/PostHog serán en «Dreamroot GPT», una carpeta local independiente de Experimental OS. No se han cambiado conexiones ni código de ese proyecto.

En producción se consultó una campaña externa existente sin vincularla ni modificarla: Meta devolvió impresiones, clics, alcance, gasto, acciones y visualizaciones por porcentaje del vídeo. OpenAI generó una propuesta con preguntas y recomendaciones de formatos desde un prompt real; se canceló la edición sin guardar la ficha. La consulta de identidad distingue permisos de página, Instagram publicitario y píxeles: una consulta opcional fallida no oculta las demás; las credenciales caducadas sí detienen el acceso.

Los avisos de seguridad de Supabase preexistentes permanecen: funciones públicas con SECURITY DEFINER y controles de autorización propios, tablas internas sin políticas de acceso y protección de contraseñas filtradas desactivada. Las nuevas funciones públicas son SECURITY INVOKER y no añadieron avisos de ese tipo.

## Documentación primaria consultada

Algunas páginas de Meta Developers devolvieron HTTP 429. Se contrastaron las operaciones y campos con el SDK oficial de Meta y su colección oficial de Marketing API:

- [Marketing API de Meta en Postman](https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi)
- [AdAccount: campañas, conjuntos, anuncios, imágenes y vídeos](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py)
- [AdCreativeObjectStorySpec: página e Instagram](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativeobjectstoryspec.py)
- [AdSet: presupuesto, optimización y segmentación](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adset.py)
- [Targeting: ubicaciones, países y edades](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/targeting.py)
- [Procesamiento de vídeos](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/video_uploader.py)
- [Insights y tipos de acciones](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py)
- [OpenAI: respuestas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Sharp: recorte y adaptación de imágenes](https://sharp.pixelplumbing.com/api-resize/)

Se mantiene Graph API v26.0, ya utilizada por la conexión piloto. Cambios de versión requieren volver a verificar payloads y una prueba con recursos pausados.
