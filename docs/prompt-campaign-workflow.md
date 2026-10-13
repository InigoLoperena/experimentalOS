# Campañas desde un prompt

Meta, Google Ads y Smartlead comparten el flujo de ficha común → canal → asistente abierto con prompt/adjuntos → propuesta aplicada → guardar → resumen de envío → aprobación → recursos pausados o borrador. Sus formularios técnicos y editores manuales de variantes no se muestran en Crear/Editar ficha. Los errores del envío remiten al prompt para completar únicamente el dato pendiente.

Las campañas nuevas se denominan **Experimento · título del experimento** mediante `experimentCampaignName`. No se trunca silenciosamente el título; si el nombre completo excede el límite de 200 caracteres de esta integración, se solicita acortarlo. Se conservan los códigos EXP internos, relaciones y recursos existentes. Los recursos previos no se renombran ni recrean. Meta diferencia las versiones históricas del nombre en su selección persistente para que sus huellas sigan siendo reproducibles al continuar un borrador aprobado.

Google Ads mantiene su alcance de Búsqueda con dos variantes de texto: los adjuntos son contexto de IA, no imágenes publicadas como anuncios de Search. La moneda omitida procede de la cuenta; fecha de inicio omitida usa el día de la cuenta; sin duración no se transmite fecha final. El usuario confirma la declaración política mediante su prompt. Destino, presupuesto, países, idioma, palabras clave y CPC continúan siendo necesarios para esta estrategia. Google valida antes de mutar y no activa recursos.

Smartlead requiere dos asuntos y cuerpos de correo distintos. La IA prepara exactamente dos variantes y asuntos de hasta 200 caracteres. El resumen permite revisar ambos antes de enviar. Remitentes, destinatarios, horarios y activación se completan en Smartlead. No se envían correos automáticamente ni se cambia la cuenta o credencial existente.

La política de nombres está centralizada para reutilizarla en futuros proveedores con creación de campañas. Metricool sigue con su alcance existente de monitorización; no se añade una creación de publicaciones por cambiar este flujo.

Validación: casos de nombres completos y límites, variantes y asuntos en el esquema de IA, presupuesto/moneda/fecha final de Google, carga de medios de Meta, pausado de recursos y compatibilidad con sus nombres históricos. Compilación y comprobación de tipos antes de publicar.
