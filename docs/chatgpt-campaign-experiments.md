# ChatGPT: diseñar y guardar una ficha en Xperiments

Desde la versión 1.3.0, el MCP público expone únicamente `prepare_experiment_save`.
El contrato público no acepta `campaign`, ni siquiera mediante la herramienta de guardado.
La antigua `prepare_campaign_experiment` devuelve Unknown tool.

La herramienta cifra los campos aprobados de la ficha y devuelve un enlace de revisión de 30 minutos. No confirma un guardado. La web autentica al usuario, lista sus proyectos autorizados y guarda tras su confirmación bajo JWT y RLS. Repetir el mismo enlace no duplica la ficha.

Las integraciones de Google, Meta, Smartlead y PostHog en la aplicación principal permanecen disponibles en sus flujos propios. Los parsers y la revisión de enlaces antiguos se conservan para no romper borradores vigentes. El complemento no es un conector de esos proveedores, no cambia código y no ejecuta experimentos.

Si la herramienta no está disponible en un chat, no se debe fabricar el enlace ni afirmar el guardado. Verificar la conexión remota y la instalación en el host. El endpoint es `https://www.xperiments.site/api/mcp`; un endpoint operativo no prueba por sí solo que un chat de ChatGPT lo tenga conectado.
