# Experimental OS: entrega inicial y siguientes fases

## Alcance actual

Desarrollo privado en Vercel Hobby y Supabase Free, sin cambio de plan ni servicios comerciales nuevos. Las capacidades se incorporan dentro de las seis secciones existentes. Imagine Builder conserva sus cinco proyectos, sus miembros y los identificadores de los dos workspaces existentes. El selector de workspace aparece solamente si la cuenta pertenece a varios.

### Base privada y multiworkspace

Las consultas usan la sesión del usuario y RLS; los datos de otros workspaces no se recuperan. La vista anónima de datos reales está desactivada; la demostración utiliza datos ficticios. Las preferencias guardadas solo pueden seleccionar memberships autorizados. Los adjuntos siguen privados.

PostHog usa una asociación verificada en `posthog_project_bindings`, de lectura para miembros y sin escritura desde el navegador. La clave histórica del servidor solo se usa con esa asociación; modificar el ID en un formulario no da acceso a otros proyectos externos. Greenroute conserva su proyecto 649336. Si desaparece un experimento de PostHog, la sincronización conserva su historial local. Las conexiones futuras necesitan credenciales independientes por workspace antes de admitir otros clientes.

### Preparación y monitorización sin IA

Cada experimento obtiene un código estable como `EXP-GREENHUNT-0001`. Los contadores están aislados por proyecto/workspace y no reutilizan códigos. Cambiar el nombre del proyecto no altera los códigos existentes.

En la ficha se gestionan estado y presupuesto previstos, fechas, zona horaria, variantes y recursos externos. Un experimento puede tener varias campañas, anuncios o publicaciones, asociados opcionalmente a una variante. Se admite ID o URL HTTPS; para importar CSV se requiere un ID sin ambigüedad. Meta dispone de consulta bajo demanda e importación revisada; la sincronización programada sigue pendiente.

Las observaciones tienen métrica, valor, unidad, moneda cuando corresponde, periodo y fuente. Se compara el periodo exacto; no se suman periodos superpuestos, snapshots acumulados ni porcentajes. Un recuento requiere enteros y una proporción valores 0–1. El CSV acepta hasta 500 filas/500 KB y exige revisión antes de importar. Reimportar el mismo recurso/métrica/periodo actualiza el valor con historial, sin duplicarlo. Los lectores consultan; propietarios y editores modifican. Las referencias compuestas impiden mezclar experimentos/proyectos/workspaces, incluso para un usuario miembro de ambos.

Las copias JSON/CSV/PDF incluyen las cuatro tablas de preparación y seguimiento. Retirar un vínculo borra sus observaciones locales con confirmación e historial; no modifica la plataforma externa.

### Primer asistente de formulario

En Crear/Editar experimento, «Preparar con IA» propone contenido para los campos actuales. Recupera descripción y North Star reales del proyecto, y hasta 20 registros recientes de objetivos, experimentos y aprendizajes bajo RLS del mismo proyecto. Los aprendizajes actuales aún no tienen validación estructurada: se tratan como conocimiento pendiente de verificar.

El usuario revisa faltantes y supuestos, pulsa «Rellenar formulario para revisar» y luego «Guardar ficha». No cambian responsable, IDs, relaciones ni las puntuaciones ICE. Los campos desconocidos no borran datos existentes. El criterio de éxito se conserva si el usuario lo ha definido en el formulario; si no, queda pendiente. La salida estructurada impide que la IA invente un umbral y el servidor aplica también esta regla. Crear/Editar incluye un canal principal (web, iOS, Android, App Store, Google Play y plataformas de adquisición) y una configuración revisable con presupuesto diario total, moneda, duración, destino, audiencia, ubicación y hasta seis variantes. La IA devuelve esa configuración estructurada; al guardar, una función SECURITY INVOKER actualiza ficha, presupuesto y variantes en una transacción bajo RLS. Conserva IDs de variantes por nombre y no retira variantes históricas. Guardar una ficha sin cambiar su configuración no revierte ajustes posteriores de seguimiento. No ofrece todavía chat estratégico general.

La clave `OPENAI_API_KEY` permanece en el servidor. Se usa Responses API con salida estructurada, `store:false`, sin herramientas externas, modelo fijado `gpt-4.1-mini-2025-04-14`, entrada total ≤32 KB y salida ≤4000 tokens. No se entrenan modelos ni se publica publicidad. Documentación: https://developers.openai.com/api/docs/guides/structured-outputs y https://developers.openai.com/api/docs/models/gpt-4.1-mini.

La base reserva 0,03 USD por solicitud con un bloqueo transaccional, un máximo de 5 USD por workspace/mes UTC y 15 segundos entre consultas. El límite es conservador: registra reservas estimadas, no la facturación real. Incluso los fallos consumen reserva; no se reintenta automáticamente. IDs de solicitud repetidos se rechazan. Los miembros no pueden editar reservas ni bajar el límite desde el navegador. Revisar tarifas antes de cambiar modelo/límites; OpenAI factura por separado y necesita saldo. El 11 de octubre la generación real se completó con HTTP 200 después de que el usuario añadiera saldo; una propuesta de Greenhunt utilizó 514 tokens.

## Base de datos y despliegue

### Conexión de lectura con Meta Ads

El piloto de Greenhunt usa un usuario técnico Employee con «Ver rendimiento» en la cuenta publicitaria y «Probar app» en la app Greenhunt. El token tiene únicamente `ads_read`, duración de 60 días y se guarda como Secret de producción en Vercel (`META_ADS_ACCESS_TOKEN`), sin archivo local ni exposición al navegador. Las variables de servidor `META_ADS_WORKSPACE_ID`, `META_ADS_PROJECT_ID` y `META_ADS_ACCOUNT_ID` fijan la asociación autorizada. Renombrar un proyecto o editar sus campos no puede ampliar acceso. Esta asociación de un solo proyecto es para el piloto; antes de añadir clientes, migrar a asociaciones administradas y credenciales individuales por tenant.

En «Conexión con Meta Ads», el usuario puede listar campañas (50 por página), completar el formulario de vinculación sin duplicar la ficha y consultar recursos vinculados de tipo campaña, conjunto o anuncio. El servidor valida sesión y RLS, asociación de proyecto/workspace y pertenencia real del recurso a la cuenta antes de pedir sus métricas. Solo hace GET a `graph.facebook.com/v26.0`; no sigue URLs de paginación que puedan contener tokens. No crea, modifica, activa ni publica anuncios.

Se puede consultar una campaña antes de vincularla; esa vista previa verifica también su cuenta y no guarda nada. La importación solo se ofrece cuando existe un vínculo explícito con el experimento. El acceso real a la cuenta, moneda USD, zona Europe/Madrid y nueve campañas se verificó en producción desde una sesión autorizada.

Los informes incluyen impresiones, clics totales, alcance y gasto/moneda para un periodo exacto de hasta 31 días. Sin datos no significa cero. Un informe de otro recurso, cuenta o periodo se rechaza. No se interpreta la North Star como clics de anuncios ni se suman acciones de conversión potencialmente superpuestas. Los datos del día pueden cambiar; el selector propone la semana anterior a hoy.

«Revisar importación de resultados» reutiliza la revisión/importación existente. Después de confirmar se guardan como importación revisada (`source=csv`), con cuenta, versión de API, fecha de consulta y advertencias en notas; la UI distingue estos datos de CSV externos y de una futura sincronización automática (`source=api`). No se amplían permisos RLS ni se emplea una clave service-role para este flujo. Reimportar el mismo periodo conserva la idempotencia y auditoría existentes. Ver documentación oficial: https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights y https://developers.facebook.com/docs/graph-api/changelog/.

La consulta de resultados no requiere nuevas migraciones adicionales. Renovar el token en Meta/Vercel al caducar o revocarse y desplegar para que el nuevo entorno llegue al servidor. La programación sigue pendiente.

### Primera creación pausada en Meta

Para experimentos guardados con canal Meta Ads y objetivo de tráfico a una web, la ficha permite revisar la cuenta y crear una campaña vacía en estado PAUSED, tras confirmación explícita. El nombre conserva el código EXP; el ID devuelto se vincula en la misma ficha. Esta primera operación no crea conjuntos, anuncios ni creatividades, no asigna presupuesto y no activa publicidad. La configuración de variantes sigue disponible para revisión y preparación manual en Meta. Las categorías especiales se excluyen de esta primera operación y requieren una preparación específica.

La escritura usa un secreto distinto, `META_ADS_WRITE_ACCESS_TOKEN`, con ads_read y ads_management, limitado por la misma asociación de cuenta/workspace/proyecto que la lectura. El usuario autorizó el 11 de octubre el permiso parcial de administrar campañas y un token de 60 días. Meta guardó el permiso, el usuario completó la verificación por SMS y el nuevo token se guardó como Secret de Production en Vercel. No se copió a archivos locales ni se mostró en el chat.

El usuario aprobó guardar el piloto `EXP-GREENHUNT-0004` y crear únicamente su campaña vacía y pausada. La API devolvió el ID `120253009075930736`; la reserva quedó `linked` y existe un único recurso Meta vinculado al experimento, proyecto Greenhunt y workspace Imagine Builder. La consulta posterior con la conexión de lectura verificó el estado externo `PAUSED`. Las dos variantes y el presupuesto previsto de 10 USD diarios permanecen en Supabase; no se enviaron presupuestos ni se crearon conjuntos o anuncios. Meta no devolvió métricas para el periodo consultado y no se importaron ceros. El piloto todavía requiere creatividades, segmentación, revisión de la métrica de éxito y fecha antes de preparar anuncios.

Una reserva transaccional evita dos creaciones iniciales del mismo experimento. El servidor vuelve a validar la revisión y la sesión antes de enviar la solicitud; solo permite POST a la cuenta fija con una lista cerrada de parámetros PAUSED. Una respuesta ambigua o un fallo tras enviar no se reintenta automáticamente: se conservan los datos de la solicitud y se exige revisar Ads Manager. Una respuesta rechazada explícitamente admite una nueva revisión. Los recursos externos no forman una transacción con PostgreSQL; si el vínculo falla después de crear, la respuesta conserva el ID y enlace para recuperarlo manualmente. Las reservas son operaciones de edición, no evidencia criptográfica de la API; las métricas mantienen su procedencia separada.

Aplicadas y verificadas en el proyecto `yjnidbgjkobzlmhpzawz` el 11 de octubre de 2026:

1. `20261011145100_workspace_security_foundation.sql`.
2. `20261011151204_experiment_monitoring.sql`.
3. `20261011151209_ai_preparation_budget.sql`.
4. `20261011203318_experiment_channels_and_media.sql`.
5. `20261011205144_meta_paused_campaign.sql`.

Los nombres de archivo coinciden con las versiones remotas. Las 001–010 representan el historial local previo; no deben repetirse en una instalación existente. Verificar migraciones remotas por nombre antes de aplicar pendientes. Las actualizaciones de SQL y las variables de entorno son independientes del despliegue de código.

Antes de la actualización se guardó una copia privada local en `.vercel/backups/`, excluida de Git. Se verificó la conservación de 16 registros y tres miembros, siete especificaciones nuevas y RLS en las cinco tablas públicas nuevas. No se alteraron cuentas ni configuración de autenticación. La reversión preferente es corregir con una migración posterior y conservar datos nuevos; no eliminar tablas si ya tienen resultados.

### Materiales para IA y preparación por canal

El usuario puede elegir hasta cuatro archivos nuevos en Crear/Editar. Se envían a OpenAI imágenes JPEG reducidas (hasta ocho imágenes/fotogramas, cada una <190 KB, total ≤1,5 MB, detail:low). Para MP4/WebM de hasta tres minutos se extraen cuatro fotogramas en el navegador; no se envía audio ni se afirma analizar el vídeo completo. Los originales, hasta 10 MB cada uno, se conservan en el bucket privado existente al guardar la ficha. Ante fallo parcial de subida se mantiene el formulario y los archivos pendientes para reintentar, sin duplicar los ya subidos. PDF/DOCX continúan como adjuntos de ficha, pero no se analizan en esta entrega. La configuración se puede copiar para preparación manual; la primera creación de campaña pausada está descrita arriba. Google Ads, Smartlead, Metricool, LinkedIn, TikTok y fichas de tiendas tienen selección y preparación compartida, pero no creación automática mediante API en esta entrega.

La migración se aplicó el 11 de octubre; se verificaron 16 registros conservados, función de guardado invoker, EXECUTE revocado a anon, RLS de adjuntos y bucket privado con MP4/WebM. Los avisos del asesor sobre funciones históricas SECURITY DEFINER y protección de contraseñas son previos; el nuevo RPC respeta RLS y no amplía esos privilegios.

## Ruta pendiente y criterios de aceptación

### Integraciones y permisos granulares · 11 de octubre

Integraciones reutiliza la sesión y los proyectos. OpenAI se configura por workspace; Meta, PostHog y los siete proveedores adicionales se configuran por proyecto. El panel es común a todos los miembros; solo `owner` (Superadministrador) puede guardar, comprobar y activar/desactivar conexiones. Las claves guardadas no se devuelven a la interfaz. La configuración de un proveedor futuro no implica que sus operaciones estén implementadas: Google Ads, Metricool, Smartlead, LinkedIn, TikTok, App Store Connect y Google Play muestran expresamente su estado pendiente.

`integration_connections` contiene metadatos con RLS de lectura para miembros y sin escritura directa. `experimental_private.integration_secrets` conserva exclusivamente ciphertext AES-256-GCM. `INTEGRATIONS_ENCRYPTION_KEY` es un Secret de servidor en Vercel; equipo, proyecto, proveedor y configuración se autentican como AAD. Una clave cifrada copiada a otra asociación no se abre. Las mutaciones RPC requieren owner y revisión temporal; la auditoría no almacena secretos. Las conexiones heredadas de Imagine Builder siguen acotadas a sus asociaciones originales de servidor hasta guardarlas desde el panel. Desactivar una conexión también bloquea su secreto heredado: no hay fallback que reactive el proveedor.

OpenAI, Meta y PostHog resuelven sus conexiones desde este almacén. La comprobación realiza consultas de lectura, sin generar contenido ni publicar campañas; OpenAI verifica acceso al modelo, pero eso no prueba saldo disponible. Cambiar la cuenta de Meta o proyecto/región de PostHog exige introducir una clave nueva. Las credenciales pueden reemplazarse por completo si se pierde la clave maestra. No se contratan servicios ni planes nuevos.

Equipo permite conceder crear, editar y eliminar de forma independiente en proyectos, experimentos, aprendizajes y GOI. Los miembros existentes conservan sus permisos. Los editores invitados después de esta actualización empiezan con consulta hasta que el superadministrador les concede acciones. Crear un experimento permite guardar transaccionalmente su configuración inicial y variantes; modificarlo, añadir materiales, resultados o preparar Meta requiere editar. `save_experiment_preparation` pasa a SECURITY DEFINER con autorización explícita de acción/workspace y validación de todas las referencias, para materializar variantes durante una creación sin conceder edición posterior. Los demás accesos se limitan por RLS y las eliminaciones de proyectos son transaccionales.

Las pruebas dirigidas cubren rechazo de otro workspace, permisos de creación sin edición, prohibición de autoconcederse permisos y APIs, acceso privado a credenciales, revisiones concurrentes, ciphertext alterado y aislamiento de configuración. El asesor marca intencionalmente [RPC SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) que comprueban identidad y permisos, y [tablas privadas sin políticas de acceso directo](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). La [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) sigue como aviso previo de Auth; no se cambió el plan ni esa opción.

Supabase confirmó la migración `20261011213846_integrations_and_team_permissions`; se conservaron los 17 registros y el recurso Meta pausado del piloto. La clave maestra se configuró en Production sin guardarla en un archivo local. La aplicación sigue pendiente de anuncios/creatividades enviados a Meta y medición de registros; esta entrega no activa publicidad. El siguiente proveedor operativo solicitado es Google Ads.

1. **Completar preparación con IA:** presupuesto/variantes transaccionales, control de revisiones y selección de archivos nuevos ya implementados. Pendiente: comprobar envío real de imágenes/vídeos, recuperar adjuntos anteriores y asignar creatividades a variantes para cada proveedor. Aceptación: prompt de Greenhunt → formulario revisado → misma ficha/código → variantes/materiales sin duplicación. Complejidad media; API de IA por consumo, dentro del cap.
2. **Meta Ads como primera integración:** comprobar permisos y capacidades actuales de la API con la cuenta real. Preparación manual asistida primero; creación de recursos pausados solo cuando esté verificada y autorizada por el usuario. OAuth/tokens privados por workspace antes de crear recursos. Guardar IDs recibidos; publicación humana en Meta, vinculación y lectura de métricas. Aceptación: campaña de Greenhunt vinculada una sola vez y métricas reconciliadas con Meta, sin solicitudes de publicación automática. Complejidad alta, riesgo de permisos/revisión de Meta; gasto publicitario separado.
3. **Aprendizajes con memoria verificable:** estado de validación, fuentes/fechas/experimento y snapshots de métricas; propuesta IA → corrección/validación humana → recuperación futura. Consultas SQL primero; pgvector solo si hay una necesidad medida. Aceptación: toda conclusión conserva procedencia y no convierte hipótesis en hechos. Complejidad media, pequeñas llamadas IA bajo cap.
4. **Sincronización programada:** ejecución limitada, idempotencia, reintentos acotados y observabilidad. Mantener actualización manual en Free; añadir tareas diarias solo donde los límites del proveedor lo permitan. Evitar análisis repetidos mediante fingerprint de datos y versión del análisis. Aceptación: reejecución no duplica recursos, periodos ni gasto de IA. Complejidad media, posibles límites de API/tiempo; revisar necesidad técnica antes de Pro.
5. **Investigación y más proveedores:** fuentes públicas citables, separación de conocimiento común y privado; una integración completa antes de ampliar. Sin Apollo/Scrap.io/Influencity en MVP. Complejidad media/alta, costes opcionales posteriores.
6. **Preparación comercial:** onboarding externo, gestión autónoma de workspaces, credenciales por tenant, límites y medición real de consumo, pruebas de aislamiento con dos clientes. Stripe y cambios de plan solo con decisión expresa posterior. Aceptación: ningún acceso cruzado y recuperación ante fallos documentada.

Las decisiones inmediatas son aislamiento, identidades estables, procedencia de métricas, autorización humana y límites de coste. Facturación, infraestructura de embeddings, microservicios, múltiples conectores y frecuencia alta de sincronización pueden aplazarse.

## Validación de esta entrega

La entrega inicial pasó 39 pruebas automatizadas. Esta ampliación pasó 18 pruebas dirigidas y compilación de producción: canales, conservación de campos humanos, límites de materiales, cadena completa de migraciones/RLS, variantes transaccionales, bloqueo de creaciones duplicadas/ambiguas y parámetros de Meta limitados a PAUSED. La interfaz de producción y dos llamadas reales de IA verificaron canal, presupuesto, duración, reparto A/B y generación de hipótesis/titulares/textos. Después de la aprobación explícita del usuario se guardó el piloto descrito arriba: ahora hay 17 registros y una reserva Meta vinculada, con una sola campaña externa creada y comprobada pausada. La carga de una imagen desde el navegador fue rechazada por la revisión automática de permisos: el envío real de materiales a OpenAI aún no está verificado. No afirmar que la integración completa de Meta esté terminada.

## Ampliación del 12 de octubre: Meta y preguntas de IA

Se incorporaron los cambios de GitHub hasta `06bcdd7` antes de desarrollar. Se conserva la nueva identidad SVG y el registro con equipo privado propio. La creación del equipo ahora es idempotente; cada cliente sigue aislado de Imagine Builder.

La IA propone objetivos y parámetros de Meta, preguntas y recomendaciones, y puede incorporar las respuestas para mejorar el formulario. La ficha prepara campañas, conjuntos y anuncios pausados con Facebook e Instagram para Feed, Stories y Reels. Permite recortar imágenes con previsualización y aprobación, o enviar MP4 originales con portada. Los IDs y recibos se guardan por paso; una respuesta ambigua bloquea la repetición. Los resultados incluyen acciones, valores y métricas de vídeo de cualquier objetivo cuando Meta los devuelve, sin sumar aliases ni inventar ceros. La consulta e importación siguen siendo bajo demanda.

Supabase confirmó `20261012123718_meta_complete_preparation`, RLS y conservación de los 17 registros y del piloto. La ampliación pasó 61 pruebas y compilación de producción; incluye pruebas simuladas del proveedor y pruebas de permisos sobre la cadena SQL completa. Antes de verificar anuncios completos en una cuenta real faltan Instagram y creatividades aprobadas. Consulte [el flujo, los objetivos admitidos y los límites](docs/META-IMPLEMENTACION.md). No se han creado anuncios ni se ha activado publicidad durante esta ampliación.
