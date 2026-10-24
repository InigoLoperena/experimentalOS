# Prompt reutilizable: landing, descubrimiento y blog seguro

Copia el siguiente prompt en el repositorio del otro proyecto y sustituye los tres campos. Compartir React, Node.js, Vercel y Supabase no garantiza una estructura idéntica: el prompt exige comprobarla antes de editar.

```text
Quiero mejorar este proyecto con una landing pública, buenas bases técnicas de SEO/AEO y un blog seguro, sin romper su aplicación actual.

Nombre del producto: [NOMBRE]
Dominio oficial: [URL]
Cuenta administradora del blog: [EMAIL]

1. Inspecciona primero el repositorio, su estado Git, instrucciones, versiones, framework, rutas, autenticación, base de datos y despliegue. Lee la documentación correspondiente a las versiones instaladas. Reutiliza lo existente y conserva los cambios ajenos. No presupongas que todos los proyectos React usan Next.js ni que tienen la misma arquitectura.

2. Crea o mejora la landing con contenido útil servido en HTML, legible sin JavaScript. Si ya existe una landing funcional, conserva su diseño y mejora primero contenido, renderizado y metadatos. Explica qué es el producto, para quién sirve, su propuesta de valor, funcionamiento y límites, basándote en funciones reales. Conserva su identidad visual. No inventes precios, reseñas, resultados, clientes ni integraciones. Incluye llamadas a la acción compatibles con el acceso actual, navegación accesible y enlaces a blog, recursos y privacidad.

3. Separa marketing y aplicación sin romper sesiones, enlaces compartidos, invitaciones ni recuperación de contraseña. Las URLs inexistentes deben devolver 404 real. Conserva o redirige correctamente los alias históricos. Excluye las pantallas privadas del índice mediante noindex y del sitemap, sin impedir que los buscadores puedan leer su noindex. Robots nunca sustituye la autenticación.

4. Configura un dominio canónico coherente, metadatos propios por página, Open Graph, tarjeta social, HTML semántico y JSON-LD seguro que coincida con el contenido visible. Publica robots.txt y sitemap.xml válidos. Añade llms.txt y documentación para agentes con capacidades y límites reales; una versión Markdown, si aporta valor, debe generarse desde la misma fuente pública. No expongas datos privados ni presentes estándares experimentales como capacidades implementadas.

5. Implementa /blog, artículos con URL estable y /blog/administrar. El administrador podrá crear, editar, previsualizar, guardar borradores, publicar, actualizar, retirar y eliminar artículos. Usa Markdown seguro o un editor equivalente, con protección frente a HTML y enlaces peligrosos. No crees ni publiques artículos inicialmente. Los artículos publicados tendrán autor, fechas, resumen, metadatos y datos estructurados; el sitemap y RSS incluirán solo contenido publicado.

6. Restringe la edición al identificador de la cuenta administradora verificada, con controles en servidor y RLS de Supabase. Ser administrador de otro equipo no concede ese permiso. No uses datos de perfil editables para autorizar, no expongas claves privilegiadas y no filtres borradores mediante páginas, APIs, metadatos o feeds. Mantén el blog separado de la información privada de los usuarios y detecta cambios simultáneos antes de sobrescribir. Las futuras publicaciones mediante instrucciones al asistente deben conservar la autorización y requerir una petición explícita de publicación.

7. Prioriza sencillez y los planes actuales, sin añadir pagos, analítica, cookies, servicios o infraestructura innecesarios. Optimiza imágenes y caché preservando calidad y actualizaciones. No crees perfiles externos ni inventes mediciones de posicionamiento o citas.

8. Avanza por etapas y valida antes de desplegar: pruebas de permisos y aislamiento, borrador/publicación/retirada, URLs directas, 404, metadatos, MIME, HTML sin JavaScript, móvil y regresión de la aplicación. Prueba publicaciones con datos aislados, no con artículos reales. Aplica migraciones por separado y afirma que están aplicadas solo después de verificarlas. Sincroniza y despliega si el flujo del proyecto ya lo autoriza; no fuerces Git ni cambies facturación. Entrega URLs, commit, pruebas realizadas, límites de la evidencia y accesos pendientes, como Search Console. No garantices indexación, posiciones ni citaciones por completar esta configuración.
```
