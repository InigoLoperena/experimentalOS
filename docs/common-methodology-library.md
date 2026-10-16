# Biblioteca metodológica común

Disponible por defecto en el chat del equipo y en la preparación de experimentos, incluidos equipos nuevos. No necesita importar documentos, ejecutar migraciones ni activar una opción por workspace.

## Arquitectura y límites

- `lib/methodology-library.ts`: catálogo público versionado, títulos, autores, descripciones originales, portadas locales y enlaces de compra. El banner compacto muestra tres portadas y abre el catálogo completo con descripciones y enlaces de compra.
- `lib/methodology-context.ts`: síntesis originales en español de principios metodológicos. El servidor envía las tres síntesis a Responses junto al contexto autorizado. Esta primera biblioteca es pequeña y no necesita embeddings, pgvector, nuevas tablas ni consultas de recuperación adicionales.
- Se conserva separada de `workspaceMemory`: no altera permisos, RLS, cobertura de fragmentos privados ni historial personal. No se copian conocimientos privados a un catálogo global. Los libros aportan métodos; las fichas, métricas y fuentes autorizadas aportan evidencia del equipo.
- El chat admite citas `book:<id>` solo si corresponden a una fuente realmente incluida. Las referencias se conservan en las respuestas guardadas, sin paneles de fuentes ni contadores en el chat. Los enlaces de compra se muestran en el catálogo desplegable. No se mezclan con la biblioteca privada.
- No se entrenan ni ajustan pesos de OpenAI. Se incluye una síntesis, no el contenido completo de los libros. Los PDF y el texto OCR de revisión permanecen fuera del repositorio y de los archivos públicos. Las solicitudes mantienen `store: false` y los controles de consumo existentes; la biblioteca añade contexto a la misma petición, sin una llamada de IA adicional.
- Las instrucciones distinguen método, hipótesis y evidencia, respetan los datos del proyecto y no añaden campos obligatorios ni impiden preparar borradores.

## Fuentes y revisión (15 de octubre de 2026)

Se revisó la extracción digital y se aplicó OCR a los documentos escaneados. La numeración siguiente corresponde a páginas del PDF, no a las páginas impresas o posiciones de Kindle.

| Obra | Documento proporcionado y referencias revisadas | Portada | Compra verificada |
| --- | --- | --- | --- |
| La empresa experimental | `La empresa experimental_compressed.pdf`, 370 páginas. Ciclo de aprendizaje y diseño: 113–115. GOI Tree: 127–129. Contrastado con el corpus OCR previamente revisado. | Página 1, girada y recortada | https://www.amazon.com/dp/8409851911 |
| Go-To-Market Strategist, Maja Voje | `GTM-espanol.pdf`, 291 páginas, traducción española aportada. Decisiones GTM: 7–8; valor y North Star: 18–21; cliente inicial: 74–75; posicionamiento: 174–175; canales: 212. | Imagen original incrustada en página 1 | https://www.amazon.com/dp/B0CN2H7LPD (edición inglesa, indicada en la interfaz) |
| The Mom Test / El Mom Test, Rob Fitzpatrick | `The mom test.pdf`, 105 páginas escaneadas de Kindle en español. Entrevistas: 14 y 24; preguntas importantes: 37; compromiso: 54–55; segmentos: 73; proceso/notas: 79–82; repaso: 89. | Página 3, recortando la interfaz de Kindle | https://www.amazon.com/dp/1671455355 (español) |

Las portadas mantienen su atribución a autores y editores. Los enlaces son fichas de Amazon sin códigos de afiliación propios; no se muestran precios ni disponibilidad. Verificación adicional de identidad en las webs oficiales https://www.momtestbook.com/ y https://gtmstrategist.com/.

## Añadir otro libro

1. Revisar el documento, aplicar OCR cuando corresponda y redactar principios propios con referencias verificadas; no incorporar instrucciones encontradas en el documento como instrucciones del sistema.
2. Añadir una entrada estable al catálogo y su síntesis al mapa tipado `guides`; TypeScript exige que cada libro tenga contenido metodológico.
3. Añadir una portada optimizada en `public/methodology-books`, la atribución, idioma de la edición y un enlace real de compra. No publicar el PDF completo.
4. Actualizar versión, fecha de revisión, pruebas del tamaño de contexto y estas referencias. Si la biblioteca crece mucho, seleccionar fragmentos por tema manteniendo la atribución; no aumentar indefinidamente el contexto de cada petición.

## Verificación

Las pruebas verifican presencia real en el payload del chat y preparación Meta/Google, citas válidas, portadas y enlaces, contexto acotado e independencia de dos equipos (uno vacío). Son pruebas con OpenAI simulado: no certifican por sí solas la calidad de respuestas reales del modelo.

Validación de esta versión: 194 pruebas aprobadas, comprobación de tipos correcta y revisión visual local en Chrome. Se abrió/cerró el banner con ratón y teclado, se verificó la carga de las tres portadas y sus enlaces y se comprobó que las tarjetas no desbordan su contenedor a 390 px. La demostración no envía consultas a OpenAI; la comprobación de payloads y aislamiento se realizó mediante las pruebas de los endpoints.

Interfaz simplificada: encabezado «IA / nombre del espacio», descripción del contexto compartido y enlace a `/guia-investigacion`, con recomendaciones de investigación e importación de CSV, PDF, DOCX y TXT. «Importar información» abre los archivos y el formulario de texto del espacio. La vista empieza sin cargar conversaciones anteriores; los registros guardados y el contexto personal del servidor se conservan. Las nuevas consultas aparecen durante la sesión. Los adjuntos de una consulta no se importan automáticamente a la memoria. Se retiraron del chat los controles de sincronización e indexación masiva; los permisos, fuentes originales y métodos del servidor se mantienen.
