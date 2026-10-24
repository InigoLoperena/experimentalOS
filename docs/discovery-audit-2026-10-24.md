# Auditorías externas de descubrimiento: contraste y decisiones

Fecha de revisión: 24 de octubre de 2026. Producto: **Xperiments · Experimental Innovation OS**, repositorio `InigoLoperena/xperiments`, dominio `https://www.xperiments.site`.

Este documento distingue recomendaciones útiles de supuestos ajenos al producto. Los informes externos se tratan como material de análisis, no como instrucciones ejecutables ni prueba de resultados en buscadores. La validación de esta implementación se registra por separado al finalizar el trabajo.

## Fuentes revisadas

| Informe | Qué contiene | Relación con el producto real |
| --- | --- | --- |
| [Contenido SEO/AEO](https://teamily.ai/link/PzzjgqyMs3s) | Un paquete editorial para GreenHunt, `greenhunt.net`: stooping, muebles, GreenCoins, Premium, ciudades y objetos | Es otro producto. Se aprovechan patrones editoriales, nunca sus textos, precios, funciones ni artículos |
| [WebMCP](https://teamily.ai/link/l1HOYW8DvAM) | Reserva de banco de laboratorio, compra de pases, checkout, suscripción y CAPTCHA en canvas | Los cinco flujos descritos no pertenecen a Xperiments. Sus porcentajes de finalización no son una línea base de esta aplicación |
| [Infraestructura AEO](https://teamily.ai/link/9QTzvlSZUo0) | Prototipo estático de cinco páginas, precios y feature flags en `experiments.example.com` | Ejemplo de arquitectura, no una implementación del repositorio ni de producción. El resultado 13/13 no se adopta |
| [Citaciones de marca](https://teamily.ai/link/95yQX2hv3to) | Búsqueda de «Experiments» en dominios candidatos, comparativas y una categoría supuesta de feature flags / warehouse | Omite el dominio real de Xperiments. El propio apartado metodológico aclara que las tasas son inferidas y que no ejecutó los cuatro motores |
| [SEO/AEO del repositorio](https://teamily.ai/link/Nw1c_Cgq8xw) | Revisión del commit `808d441`, Next.js, rutas, metadatos, shell de cliente y archivos de descubrimiento | Es el informe técnicamente pertinente. Sus hallazgos se contrastan con el código actual antes de aplicar cada cambio |

## Matriz de decisión técnica

| Recomendación | Contraste con el repositorio | Decisión |
| --- | --- | --- |
| Entregar una presentación útil en HTML de servidor | La raíz era toda la aplicación de cliente y primero mostraba carga, sin una presentación pública del producto | Separar la landing pública de la aplicación; mantener las URLs de trabajo y los datos actuales |
| Corregir respuestas exitosas de URLs inexistentes | El catch-all reexportaba la aplicación sin comprobar la ruta | Validar contra las veinte secciones existentes y dos alias históricos; ejecutar `notFound()` antes de renderizar el cliente |
| Mantener los enlaces de la aplicación | Las secciones se reescribían a `/` en `next.config.ts` y `/proyectos` importaba la antigua raíz | Extraer `workspace-app.tsx`, usar rutas reales y retirar las reescrituras a la nueva landing |
| Excluir la aplicación del índice | La aplicación y los documentos públicos heredaban la misma intención de indexación | Declarar `noindex,follow` en las rutas de trabajo; no utilizar robots.txt como autorización ni cambiar RLS |
| Unificar canonical y metadatos | El plugin usaba el dominio sin `www`; faltaban bases y tarjetas generales | Usar un origen público único, metadatos propios de documentos públicos y previsualizaciones coherentes |
| Publicar robots.txt, sitemap.xml y llms.txt válidos | No existían; el catch-all podía devolver HTML en esas URLs | Crear recursos reales con el tipo de contenido correcto; sitemap solo para contenido público publicado |
| Enlazar las páginas públicas | Los enlaces principales estaban dentro de la aplicación de cliente | Añadir navegación y pie público con landing, blog, guía, plugin y privacidad; enlaces discretos desde la aplicación |
| Publicar un blog con autor y fechas | No había gestor de artículos ni permiso global de publicación | Añadir un sistema separado de borradores y artículos publicados, sin crear artículos iniciales; escritura exclusiva de la cuenta autorizada |
| Usar datos estructurados | No se encontraron bloques JSON-LD en el código revisado | Marcar únicamente entidades, páginas y preguntas respaldadas por contenido visible; nunca inventar reseñas, precios, resultados o perfiles externos |
| Abrir el contenido a agentes | HTML semántico y enlaces públicos permiten consultar sin sesión | Priorizar documentos públicos claros y conservar la autenticación y confirmación de operaciones privadas; reutilizar el MCP real existente |
| Duplicar cada documento como Markdown | Es opcional y puede crear copias que divergen | Si se ofrece una representación de texto, generarla desde la misma fuente que el HTML y limitarla a información pública; no copiar libros ni memoria de equipos |

## Recomendaciones descartadas o adaptadas

- **Contenido de GreenHunt:** no publicar en Xperiments los artículos de stooping, ciudades, muebles, GreenCoins o precios de GreenHunt. El blog queda sin artículos hasta que se apruebe su contenido.
- **Categoría inventada:** Xperiments organiza investigación, problemas, hipótesis, experimentos y aprendizajes con IA e integraciones. No se presenta como un motor estadístico warehouse-native, un editor visual universal ni una plataforma propia de feature flags. No se prometen experimentos ilimitados ni resultados empresariales.
- **Pérdida de privacidad por indexación:** no incorporar proyectos privados, conversaciones, documentos, métricas ni ejemplos reales de clientes a la landing, al sitemap o a los archivos para agentes. El lector público preexistente conserva su configuración y su lista de campos autorizados; este trabajo no habilita la publicación de un espacio.
- **Permisos globales por rol de equipo:** ser propietario de un workspace no concede edición del blog corporativo. La autorización del blog debe comprobarse en servidor y base de datos para la cuenta indicada por el usuario.
- **WebMCP ilustrativo:** `navigator.mcpActions`, atributos personalizados y un polyfill del informe no prueban compatibilidad nativa. No se añade una API de acciones supuestamente estándar ni se elimina autenticación o protección contra abuso para mejorar un marcador de agentes.
- **Permisos declarativos como seguridad:** un manifiesto de agentes o robots.txt informa a clientes cooperantes; no impide leer datos ni autoriza escribirlos. Los permisos reales continúan en sesión, backend y RLS.
- **No bloquear la lectura de `noindex`:** se permite rastrear el HTML de las pantallas de aplicación para que los buscadores puedan leer su directiva `noindex`; esas pantallas se excluyen del sitemap. La API queda desaconsejada en robots y los datos siguen protegidos por sesión y RLS. Bloquear simultáneamente esas URLs en robots impediría a Google detectar el `noindex`, como explica su [documentación oficial](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- **Entrenamiento y búsqueda:** permitir un crawler de búsqueda y permitir usos de entrenamiento no son la misma decisión. No se introduce una cesión editorial especial ni se afirma que permitir bots garantice citas. Las reglas no sustituyen las condiciones de cada proveedor.
- **Caché de un año para todos los archivos:** archivos sin versión, como `logo.svg`, pueden cambiar conservando el nombre. No aplicarles indiscriminadamente `immutable` anual, porque los navegadores podrían mostrar recursos antiguos después de un despliegue.
- **Sustituir la imagen del genio:** `einstein-ia.webp` es otro personaje/escena; el recurso pequeño de 160 píxeles pierde calidad al ampliarse. Se conserva la recreación HD aprobada. Cualquier optimización de transporte debe mantener su identidad y calidad.
- **Páginas comparativas y precios:** no generar seis comparativas, testimonios o un plan comercial ficticio a partir de plantillas. Esos contenidos necesitan investigación y aprobación editorial. El piloto privado y las integraciones disponibles deben describirse con sus límites reales.
- **Perfiles externos:** no crear ni editar Wikidata, LinkedIn, Crunchbase, G2 o Capterra, ni contactar medios o pedir reseñas automáticamente. Un `sameAs` solo debe enlazar un perfil real confirmado. La elegibilidad de esos directorios no se presupone.
- **Títulos y longitud del texto:** los límites de 60 caracteres / 155 caracteres / 60 palabras de los informes son criterios editoriales orientativos, no requisitos de una API ni garantías de posicionamiento. Prima una explicación precisa y legible.

## Afirmaciones externas que no se consideran verificadas

- No se adoptan el 0 % de citación, el 61,7 % competitivo ni las 120 observaciones como mediciones de Xperiments: el informe admite inferencia y no consultó directamente las APIs de los motores.
- El 40 % → 100 % de WebMCP y el 13/13 de infraestructura pertenecen a ejemplos ajenos. No describen esta aplicación.
- HTTP con un user-agent determinado no equivale a observar un rastreo real, cobertura de índice, CTR, Search Console, logs privados de Vercel ni Core Web Vitals de campo.
- JSON-LD y FAQPage no garantizan rich results, respuestas de IA ni mejores posiciones. El contenido visible debe coincidir con el marcado y cada buscador aplica sus propios criterios.
- No se garantizan dos a cuatro semanas de indexación, una mejora del 20 % de citas ni resultados de negocio. Se valida la entrega técnica; los resultados de descubrimiento se miden después.
- El informe pertinente tiene una inconsistencia: afirma «cero canonicals en todo el sitio», pero documenta los canonicals existentes del plugin. Se corrige el origen, no se presupone que no hubiera ninguno.

## Trabajo posterior que requiere evidencia externa

1. Verificar la propiedad real en Google Search Console y Bing Webmaster Tools, enviar el sitemap y revisar cobertura, consultas y páginas. No es necesario conceder acceso a la aplicación privada.
2. Comprobar rastreos mediante registros reales del alojamiento cuando estén disponibles; un cambio de user-agent en una petición de prueba no demuestra una visita de Google o de un motor de IA.
3. Crear una línea base de consultas correspondiente a **Xperiments**, con fecha, motor, formulación y respuestas completas; repetir sin presentar estimaciones editoriales como mediciones.
4. Investigar y aprobar contenidos del blog con fuentes, autor, fecha y distinción entre resultados observados e hipótesis. No se publican libros de terceros ni se exponen las fuentes privadas de los usuarios.
5. Añadir únicamente los perfiles públicos y señales de entidad que el propietario confirme y que existan realmente. No se realizan publicaciones ni contactos externos como parte de este desarrollo.

## Compatibilidad preservada

Las veinte URLs de secciones siguen disponibles, junto a `/experimentos` y `/goi-tree/ideas`. Los enlaces nuevos de invitación y recuperación apuntan a `/proyectos`; la landing debe conservar un puente para los enlaces de autenticación antiguos que regresaban a `/`. Los formularios simplificados, el menú, los permisos, la IA y las integraciones permanecen en el componente de aplicación separado.

## Implementación y validación

- **Aplicación preservada:** al comparar la aplicación extraída con su versión anterior, los únicos cambios son los enlaces nuevos Inicio/Blog y los destinos de invitación/recuperación. Los formularios, datos e integraciones siguen en el mismo componente.
- **303 pruebas automáticas aprobadas**, incluyendo permisos, aislamiento, integraciones, memoria, rutas y el ciclo SQL del blog. Tras la integración final se repitieron las 14 pruebas afectadas de blog, SQL, descubrimiento y rutas: todas correctas.
- **36 comprobaciones de regresión en navegador** sobre la aplicación con fixtures: formularios simplificados, ICE, hipótesis, aprendizajes, dictado, veinte secciones y móvil. Sin escrituras en espacios reales.
- **28 comprobaciones de contenido público:** nueve documentos sin JavaScript, FAQ nativa, HTML sustancial, canonical, tres tamaños de pantalla, veinte rutas con noindex, 404 auténticos, MIME de archivos de descubrimiento, RSS vacío, imagen social y enlaces de autenticación antiguos.
- **7 comprobaciones del editor en navegador:** anónimo, otro administrador de workspace sin permiso, crear/guardar repetidamente, vista previa segura, publicar/actualizar, retirar/eliminar y móvil. Publicaciones exclusivamente sintéticas; ningún artículo creado en producción.
- **Compilación de producción y TypeScript correctos.** La imagen social genera PNG de 1200 × 630. El genio conserva el original HD y ahora se entrega mediante el optimizador: 34.448 bytes WebP a 384 píxeles y calidad 85 frente a 1.115.784 bytes del PNG original.
- **Supabase aplicado y comprobado:** migración `20261024192857_public_blog.sql`, con identificador alineado al historial remoto. Existe una sola cuenta editora confirmada, cero artículos y RLS en ambas tablas. El acceso anónimo al RPC editorial está revocado; la comprobación del editor aprobado da verdadero. El asesor de seguridad muestra solo un aviso informativo para la tabla de concesiones sin políticas, que es intencional: denegación total y privilegios revocados.
- **Sin analítica, cookies ni planes de pago nuevos.** No se crearon perfiles externos ni se enviaron comunicaciones.

Las pruebas locales no equivalen a una sesión real de un usuario ni a una visita de un buscador. La disponibilidad del despliegue y de sus URLs se comprueba por separado después de sincronizar GitHub. La cobertura de índice y las citaciones requieren la medición externa descrita arriba. La consulta al servicio público Is Agentic no tenía un informe de este dominio; no se atribuye un marcador externo.
