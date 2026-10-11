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

El usuario revisa faltantes y supuestos, pulsa «Rellenar formulario para revisar» y luego «Guardar ficha». No cambian responsable, IDs, relaciones ni las puntuaciones ICE. Los campos desconocidos no borran datos existentes. El criterio de éxito se conserva si el usuario lo ha definido en el formulario; si no, queda pendiente. La salida estructurada impide que la IA invente un umbral y el servidor aplica también esta regla. Las variantes/presupuesto se describen por ahora en el texto del formulario; deben registrarse en el panel de preparación. Esta entrega no lee archivos adjuntos ni ofrece chat estratégico general; son ampliaciones de la fase 2.

La clave `OPENAI_API_KEY` permanece en el servidor. Se usa Responses API con salida estructurada, `store:false`, sin herramientas externas, modelo fijado `gpt-4.1-mini-2025-04-14`, entrada total ≤32 KB y salida ≤2400 tokens. No se entrenan modelos ni se publica publicidad. Documentación: https://developers.openai.com/api/docs/guides/structured-outputs y https://developers.openai.com/api/docs/models/gpt-4.1-mini.

La base reserva 0,03 USD por solicitud con un bloqueo transaccional, un máximo de 5 USD por workspace/mes UTC y 15 segundos entre consultas. El límite es conservador: registra reservas estimadas, no la facturación real. Incluso los fallos consumen reserva; no se reintenta automáticamente. IDs de solicitud repetidos se rechazan. Los miembros no pueden editar reservas ni bajar el límite desde el navegador. Revisar tarifas antes de cambiar modelo/límites; OpenAI factura por separado y necesita saldo. El 11 de octubre la generación real se completó con HTTP 200 después de que el usuario añadiera saldo; una propuesta de Greenhunt utilizó 514 tokens.

## Base de datos y despliegue

### Conexión de lectura con Meta Ads

El piloto de Greenhunt usa un usuario técnico Employee con «Ver rendimiento» en la cuenta publicitaria y «Probar app» en la app Greenhunt. El token tiene únicamente `ads_read`, duración de 60 días y se guarda como Secret de producción en Vercel (`META_ADS_ACCESS_TOKEN`), sin archivo local ni exposición al navegador. Las variables de servidor `META_ADS_WORKSPACE_ID`, `META_ADS_PROJECT_ID` y `META_ADS_ACCOUNT_ID` fijan la asociación autorizada. Renombrar un proyecto o editar sus campos no puede ampliar acceso. Esta asociación de un solo proyecto es para el piloto; antes de añadir clientes, migrar a asociaciones administradas y credenciales individuales por tenant.

En «Conexión con Meta Ads», el usuario puede listar campañas (50 por página), completar el formulario de vinculación sin duplicar la ficha y consultar recursos vinculados de tipo campaña, conjunto o anuncio. El servidor valida sesión y RLS, asociación de proyecto/workspace y pertenencia real del recurso a la cuenta antes de pedir sus métricas. Solo hace GET a `graph.facebook.com/v26.0`; no sigue URLs de paginación que puedan contener tokens. No crea, modifica, activa ni publica anuncios.

Los informes incluyen impresiones, clics totales, alcance y gasto/moneda para un periodo exacto de hasta 31 días. Sin datos no significa cero. Un informe de otro recurso, cuenta o periodo se rechaza. No se interpreta la North Star como clics de anuncios ni se suman acciones de conversión potencialmente superpuestas. Los datos del día pueden cambiar; el selector propone la semana anterior a hoy.

«Revisar importación de resultados» reutiliza la revisión/importación existente. Después de confirmar se guardan como importación revisada (`source=csv`), con cuenta, versión de API, fecha de consulta y advertencias en notas; la UI distingue estos datos de CSV externos y de una futura sincronización automática (`source=api`). No se amplían permisos RLS ni se emplea una clave service-role para este flujo. Reimportar el mismo periodo conserva la idempotencia y auditoría existentes. Ver documentación oficial: https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights y https://developers.facebook.com/docs/graph-api/changelog/.

Esta entrega no requiere nuevas migraciones. Renovar el token en Meta/Vercel al caducar o revocarse y desplegar para que el nuevo entorno llegue al servidor. La programación y la creación de recursos pausados necesitan trabajo y autorizaciones posteriores.

Aplicadas y verificadas en el proyecto `yjnidbgjkobzlmhpzawz` el 11 de octubre de 2026:

1. `20261011145100_workspace_security_foundation.sql`.
2. `20261011151204_experiment_monitoring.sql`.
3. `20261011151209_ai_preparation_budget.sql`.

Los nombres de archivo coinciden con las versiones remotas. Las 001–010 representan el historial local previo; no deben repetirse en una instalación existente. Verificar migraciones remotas por nombre antes de aplicar pendientes. Las actualizaciones de SQL y las variables de entorno son independientes del despliegue de código.

Antes de la actualización se guardó una copia privada local en `.vercel/backups/`, excluida de Git. Se verificó la conservación de 16 registros y tres miembros, siete especificaciones nuevas y RLS en las cinco tablas públicas nuevas. No se alteraron cuentas ni configuración de autenticación. La reversión preferente es corregir con una migración posterior y conservar datos nuevos; no eliminar tablas si ya tienen resultados.

## Ruta pendiente y criterios de aceptación

1. **Completar preparación con IA:** aplicar presupuesto/variantes de forma transaccional y con control de revisiones; selección explícita de adjuntos compatibles y comprobación de acceso/tamaño. Aceptación: prompt de Greenhunt → formulario revisado → misma ficha/código → variantes/materiales sin duplicación. Probar concurrencia, errores y límites. Complejidad media; API de IA por consumo, dentro del cap.
2. **Meta Ads como primera integración:** comprobar permisos y capacidades actuales de la API con la cuenta real. Preparación manual asistida primero; creación de recursos pausados solo cuando esté verificada y autorizada por el usuario. OAuth/tokens privados por workspace antes de crear recursos. Guardar IDs recibidos; publicación humana en Meta, vinculación y lectura de métricas. Aceptación: campaña de Greenhunt vinculada una sola vez y métricas reconciliadas con Meta, sin solicitudes de publicación automática. Complejidad alta, riesgo de permisos/revisión de Meta; gasto publicitario separado.
3. **Aprendizajes con memoria verificable:** estado de validación, fuentes/fechas/experimento y snapshots de métricas; propuesta IA → corrección/validación humana → recuperación futura. Consultas SQL primero; pgvector solo si hay una necesidad medida. Aceptación: toda conclusión conserva procedencia y no convierte hipótesis en hechos. Complejidad media, pequeñas llamadas IA bajo cap.
4. **Sincronización programada:** ejecución limitada, idempotencia, reintentos acotados y observabilidad. Mantener actualización manual en Free; añadir tareas diarias solo donde los límites del proveedor lo permitan. Evitar análisis repetidos mediante fingerprint de datos y versión del análisis. Aceptación: reejecución no duplica recursos, periodos ni gasto de IA. Complejidad media, posibles límites de API/tiempo; revisar necesidad técnica antes de Pro.
5. **Investigación y más proveedores:** fuentes públicas citables, separación de conocimiento común y privado; una integración completa antes de ampliar. Sin Apollo/Scrap.io/Influencity en MVP. Complejidad media/alta, costes opcionales posteriores.
6. **Preparación comercial:** onboarding externo, gestión autónoma de workspaces, credenciales por tenant, límites y medición real de consumo, pruebas de aislamiento con dos clientes. Stripe y cambios de plan solo con decisión expresa posterior. Aceptación: ningún acceso cruzado y recuperación ante fallos documentada.

Las decisiones inmediatas son aislamiento, identidades estables, procedencia de métricas, autorización humana y límites de coste. Facturación, infraestructura de embeddings, microservicios, múltiples conectores y frecuencia alta de sincronización pueden aplazarse.

## Validación de esta entrega

39 pruebas automatizadas, compilación de producción y revisión de interfaz en demostración. Las pruebas verifican RLS, roles, referencias cruzadas, códigos inmutables, integridad de métricas, reimportación con auditoría y reservas de IA que no pueden modificarse desde el cliente. La consulta de modelo y una generación real fueron HTTP 200, con salida estructurada validada. No afirmar que la integración de Meta o la lectura de adjuntos por IA esté completada.
