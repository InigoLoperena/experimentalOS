# Administrar el blog de Xperiments

El blog está en `https://www.xperiments.site/blog`. Su editor está en `https://www.xperiments.site/blog/administrar`.

1. Inicia sesión en Xperiments con la cuenta `inigoloperena@gmail.com`.
2. Abre **Administrar blog** desde el listado del blog.
3. Escribe título, URL, autor, resumen y contenido en Markdown. Puedes previsualizarlo sin publicarlo.
4. **Guardar borrador** conserva el trabajo de forma privada. **Publicar artículo** lo hace público. Un artículo publicado puede actualizarse o retirarse para volver a borrador.

La URL se bloquea después de la primera publicación para conservar sus enlaces. Las revisiones simultáneas se detectan: si otra ventana modifica un artículo, se debe recargar antes de sobrescribirlo. El HTML del contenido se muestra como texto; los enlaces admiten únicamente protocolos seguros.

## Acceso y datos

El permiso editorial no procede de un rol de workspace. Se concede únicamente al UUID de la cuenta confirmada indicada, y se comprueba de nuevo en el backend y en las políticas de Supabase. Los administradores de otros equipos no pueden editar el blog. La tabla de concesiones no admite lectura o escritura por clientes.

Los borradores no aparecen en las páginas públicas, el sitemap, RSS, los metadatos ni los archivos para agentes. Las tablas `blog_posts` y `blog_editors` son independientes de proyectos, experimentos y memoria privada de IA. El sistema empieza sin artículos.

## Publicación mediante instrucciones al asistente

Puedes pedir preparar o publicar un artículo indicando su título, enfoque y fuentes. Preparar contenido no significa publicarlo: la publicación requiere una instrucción explícita y una operación autenticada del editor, conservando estas mismas restricciones. El conector MCP público de experimentos no tiene permisos editoriales ni publica artículos.

La API del editor es `GET /api/blog` y `POST /api/blog`, con sesión Bearer verificada. Las operaciones de actualización/eliminación exigen `id` y `expected_updated_at`; no se admiten identificadores de workspace, fechas ni autores internos enviados por el cliente. Nunca copies tokens en chats, documentos públicos o artículos.
