# ChatGPT: diseñar y guardar una ficha en Xperiments

La única herramienta pública es `prepare_experiment_save`. Acepta título, contexto, hipótesis, métrica, criterio de éxito y, de forma opcional, fecha, etiquetas y puntuaciones ICE. Rechaza cualquier campo no incluido en ese contrato.

Devuelve un enlace cifrado válido durante 30 minutos, con saved=false y pending_confirmation. En ChatGPT web se usa desde Work. El usuario abre el enlace, inicia sesión, selecciona un proyecto autorizado y confirma el guardado. Repetir el mismo enlace/cuenta/proyecto no duplica la ficha. La consulta, edición y eliminación posteriores se realizan en Xperiments. Guardar un plan no ejecuta la prueba.

El contrato, el servicio de guardado y la página de revisión solo contienen este flujo.
