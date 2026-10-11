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

1. **Completar preparación con IA:** presupuesto/variantes transaccionales, control de revisiones y selección de archivos nuevos ya implementados. Pendiente: comprobar envío real de imágenes/vídeos, recuperar adjuntos anteriores y asignar creatividades a variantes para cada proveedor. Aceptación: prompt de Greenhunt → formulario revisado → misma ficha/código → variantes/materiales sin duplicación. Complejidad media; API de IA por consumo, dentro del cap.
2. **Meta Ads como primera integración:** comprobar permisos y capacidades actuales de la API con la cuenta real. Preparación manual asistida primero; creación de recursos pausados solo cuando esté verificada y autorizada por el usuario. OAuth/tokens privados por workspace antes de crear recursos. Guardar IDs recibidos; publicación humana en Meta, vinculación y lectura de métricas. Aceptación: campaña de Greenhunt vinculada una sola vez y métricas reconciliadas con Meta, sin solicitudes de publicación automática. Complejidad alta, riesgo de permisos/revisión de Meta; gasto publicitario separado.
3. **Aprendizajes con memoria verificable:** estado de validación, fuentes/fechas/experimento y snapshots de métricas; propuesta IA → corrección/validación humana → recuperación futura. Consultas SQL primero; pgvector solo si hay una necesidad medida. Aceptación: toda conclusión conserva procedencia y no convierte hipótesis en hechos. Complejidad media, pequeñas llamadas IA bajo cap.
4. **Sincronización programada:** ejecución limitada, idempotencia, reintentos acotados y observabilidad. Mantener actualización manual en Free; añadir tareas diarias solo donde los límites del proveedor lo permitan. Evitar análisis repetidos mediante fingerprint de datos y versión del análisis. Aceptación: reejecución no duplica recursos, periodos ni gasto de IA. Complejidad media, posibles límites de API/tiempo; revisar necesidad técnica antes de Pro.
5. **Investigación y más proveedores:** fuentes públicas citables, separación de conocimiento común y privado; una integración completa antes de ampliar. Sin Apollo/Scrap.io/Influencity en MVP. Complejidad media/alta, costes opcionales posteriores.
6. **Preparación comercial:** onboarding externo, gestión autónoma de workspaces, credenciales por tenant, límites y medición real de consumo, pruebas de aislamiento con dos clientes. Stripe y cambios de plan solo con decisión expresa posterior. Aceptación: ningún acceso cruzado y recuperación ante fallos documentada.

Las decisiones inmediatas son aislamiento, identidades estables, procedencia de métricas, autorización humana y límites de coste. Facturación, infraestructura de embeddings, microservicios, múltiples conectores y frecuencia alta de sincronización pueden aplazarse.

## Validación de esta entrega

La entrega inicial pasó 39 pruebas automatizadas. Esta ampliación pasó 18 pruebas dirigidas y compilación de producción: canales, conservación de campos humanos, límites de materiales, cadena completa de migraciones/RLS, variantes transaccionales, bloqueo de creaciones duplicadas/ambiguas y parámetros de Meta limitados a PAUSED. La interfaz de producción y dos llamadas reales de IA verificaron canal, presupuesto, duración, reparto A/B y generación de hipótesis/titulares/textos. Después de la aprobación explícita del usuario se guardó el piloto descrito arriba: ahora hay 17 registros y una reserva Meta vinculada, con una sola campaña externa creada y comprobada pausada. La carga de una imagen desde el navegador fue rechazada por la revisión automática de permisos: el envío real de materiales a OpenAI aún no está verificado. No afirmar que la integración completa de Meta esté terminada.
