# ChatGPT: diseñar y guardar una ficha en Xperiments

La única herramienta pública es `prepare_experiment_save`. Acepta título, contexto, hipótesis, métrica, criterio de éxito y, de forma opcional, fecha, etiquetas y puntuaciones ICE. Rechaza cualquier campo no incluido en ese contrato.

Devuelve un enlace cifrado válido durante 30 minutos, con saved=false y pending_confirmation. Se utiliza en cualquier conversación compatible de ChatGPT o Codex que exponga la herramienta MCP remota. No requiere ejecución local ni fuerza Work. La disponibilidad depende del host, la cuenta y las políticas de OpenAI; cambiar las instrucciones no puede activar una herramienta que el host no exponga.

El usuario abre el enlace, inicia sesión en su propia cuenta, selecciona un proyecto autorizado y confirma el guardado. No se usa una cuenta fija del creador ni una clave de servicio para guardar. La sesión verificada y RLS determinan el acceso; la ficha usa el espacio del proyecto y al usuario como Responsable. Si la cuenta cambia en otra pestaña entre la revisión y la confirmación, se exige revisar de nuevo antes de enviar el guardado. Una cuenta nueva necesita completar su registro y crear un proyecto; un miembro de equipo necesita experiments.create. La página permite volver a cargar los proyectos después de crearlos.

Repetir el mismo enlace/cuenta/proyecto no duplica la ficha. Dos cuentas distintas pueden guardar el plan en sus propios proyectos sin compartir registros. La consulta, edición y eliminación posteriores se realizan en Xperiments. Guardar un plan no ejecuta la prueba y el chat no recibe confirmación automática del guardado web.

El contrato, el servicio de guardado y la página de revisión solo contienen este flujo.
