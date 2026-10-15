# Experimentos A/B con PostHog

El administrador configura una clave personal cifrada por workspace. Los perfiles
por proyecto permiten seleccionar el proyecto y región de PostHog sin duplicar
credenciales. Se conservan las vinculaciones históricas.

El canal PostHog y los canales Web app/iOS/Android comparten este recorrido:

Prompt y adjuntos → propuesta revisable → guardar ficha → Enviar a PostHog →
borrador A/B y feature flag desactivada → revisión e implementación en la app →
activación manual → consulta de resultados.

La IA puede proponer dos variantes, reparto, porcentaje global de entrada, evento
y ventana de conversión. Consulta definiciones de eventos del proyecto conectado.
El servidor vuelve a verificar el evento antes de asignar una métrica inline de
conversión (`funnel`) o recuento por usuario (`mean`). Los eventos no confirmados
quedan pendientes sin impedir la creación del borrador. No se habilita
`allow_unknown_events` ni se inventa instrumentación. La fecha de la ficha no se
envía como fecha de lanzamiento. Los adjuntos siguen siendo privados en Experiments;
no se publican automáticamente como cambios visuales de una web.

El nombre remoto es `Experimento · título`; la clave de flag es estable y deriva
del UUID interno. `posthog_preparations` registra el intento antes del POST externo,
serializando los envíos por experimento y conservando las respuestas inciertas.
El ID y el enlace se guardan junto con `posthog_experiment_id` y `external_resources`.
Actualizar el estado puede recuperar un POST interrumpido buscando la clave
determinista, sin repetirlo. Se comprueba que el recurso sea un borrador y que su
flag esté desactivada; no hay llamadas a launch, ni despliegues sobre la app probada.

La ficha muestra los datos del experimento, nombre, ID, estado, enlace, adjuntos y
resultados, sin desplegar formularios técnicos del proveedor. Se conserva la
edición de la ficha actualizando su revisión después de la vinculación automática.
Los lectores consultan el estado y resultados; enviar exige permiso de edición.

Para resultados modernos se leen cálculos guardados mediante
`metrics_recalculation/latest`, con compatibilidad con `results` en versiones
anteriores. Consultar una ficha no inicia recálculos ni consultas analíticas nuevas.
Los borradores muestran que aún no tienen resultados; no se representan como cero.

Requisitos de la clave: `project:read`, `experiment:read`, `experiment:write`,
`event_definition:read`, más el permiso del usuario para crear flags en el proyecto.
Se utiliza la API REST existente; no se añade una capa Flags SDK ni otra base de datos.

La migración `posthog_draft_delivery` añade el canal, el registro de intentos y
funciones con control de acceso. Su aplicación es independiente del despliegue de
Next.js. Las pruebas de servidor cubren credenciales del equipo, perfiles, revisiones
obsoletas, estados inciertos y recuperación; PostgreSQL local verifica RLS, permisos,
duplicados y vinculación atómica sin perder campos del experimento.

Prueba real del 15 de octubre de 2026: desde la aplicación desplegada, un prompt
creó la ficha «QA PostHog · Bienvenida A/B» y el borrador PostHog 485544 en el
proyecto 649336. El POST y la lectura posterior confirmaron la flag desactivada,
el reparto 60/40 y el alcance global del 20 %. La actualización de estado conservó
el vínculo y la consulta de resultados informó correctamente que seguía en borrador.
No se activó la prueba ni se generaron exposiciones. La métrica quedó pendiente
porque no había un evento de bienvenida confirmado; no se validaron resultados de
un experimento activo. La consola de PostHog exigía iniciar sesión, por lo que
la verificación remota se hizo mediante las respuestas autenticadas de su API.

Fuentes oficiales:

- [API de experimentos](https://posthog.com/docs/api/experiments)
- [Implementar variantes](https://posthog.com/docs/experiments/start-here)
- [Contrato y validaciones del servidor](https://github.com/PostHog/posthog/blob/master/products/experiments/backend/experiment_service.py)
