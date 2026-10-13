# Meta desde el prompt

La ficha conserva sus campos comunes y el selector de canal. Meta abre directamente el asistente; no muestra el formulario técnico ni la edición manual de variantes. El prompt puede completar la configuración parcial. Tras aplicar y guardar, la revisión de Meta presenta un resumen, textos, archivos asignados y previsualizaciones. Una sola aprobación confirma el público, el presupuesto, las categorías y los recortes antes de crear recursos pausados.

No se ofrece la vía antigua de campaña vacía en la interfaz. La preparación completa conserva cada ID por paso y registra errores o resultados inciertos; solo indica finalización al completar anuncios y materiales. Los recibos existentes siguen disponibles para continuar sin recrear pasos confirmados.

## Propuestas y datos obligatorios

- Los datos omitidos no impiden guardar el experimento. El envío requiere los mínimos de la operación de Meta: destino/copies/materiales, objetivo, zona, identidad autorizada y presupuesto para crear conjuntos.
- Edad y formatos omitidos: propuesta de 18–65+ y Feed/Stories/Reels, visible antes de aprobar. Un reparto completamente pendiente se propone igual entre variantes. Un reparto parcial o inválido sigue necesitando corrección mediante el prompt.
- La divisa procede de la cuenta real si falta en la ficha. Con duración se divide el presupuesto total del periodo; sin duración se divide el presupuesto diario y se omite el fin. Inicio técnico futuro propuesto para revisión. Nada se activa automáticamente.
- Solo público amplio por zona y edad; describir intereses no los aplica. Conversiones necesitan píxel y evento accesibles. Las categorías especiales no están soportadas por este flujo.

## Materiales

Se usa la asignación por nombre exacto de la IA, sin distinguir mayúsculas. Si no hay nombres, una imagen sirve para todas las variantes; si hay un archivo por variante, se asignan por orden de nombre y se muestran para revisar. Ambigüedades o archivos desconocidos bloquean el envío, no producen una campaña vacía como alternativa. Los vídeos necesitan una portada y MP4; no se promete recorte de vídeo. Las imágenes se recortan a partir del adjunto privado y se aprueban sus previsualizaciones antes de subirlas.

La campaña nueva se llama «Experimento · título del experimento» (hasta 200 caracteres incluyendo el prefijo), conservando su ID interno por relaciones de base de datos. Las preparaciones históricas conservan su nombre anterior al reanudarse para no invalidar su huella ni repetir recursos.

## Investigación del caso existente

En el experimento «Campaña Meta Ads Greenhunt - Test A/B Gamificación vs. Mapa de Objetos» constan dos adjuntos. La preparación de 2026-10-12 creó campaña, subió una imagen y creó un conjunto; la creatividad fue rechazada y por eso no hay anuncio vinculado. El hash confirma la subida de la imagen, no la creación del anuncio. No se puede deducir el motivo exacto del rechazo a partir de ese recibo vacío; se necesita la respuesta de Meta al continuar.

## Validación

Pruebas de asignación a imágenes privadas por variante, nombre exacto, presupuesto diario sin duración, conservación de presupuesto, previsualización/subida idénticas, bloqueo de materiales incorrectos y reanudación sin repetir pasos. Comprobación de tipos y compilación antes de publicar. No requiere migraciones.
