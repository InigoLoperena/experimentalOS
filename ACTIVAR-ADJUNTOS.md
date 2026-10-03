# Activar archivos y enlaces en las fichas

El código se despliega desde GitHub. Para guardar adjuntos reales, activa esta actualización en tu proyecto Supabase:

1. Entra en [Supabase](https://supabase.com/dashboard) y abre el proyecto de Experimental OS.
2. Entra en **SQL Editor → New query**.
3. Abre [004_record_attachments.sql](https://github.com/InigoLoperena/experimentalOS/blob/main/supabase/migrations/004_record_attachments.sql), pulsa **Raw** y copia todo el contenido.
4. Pégalo en la nueva consulta y pulsa **Run**. Cuando termine correctamente, recarga Experimental OS.

Si todavía no ejecutaste la actualización 003, hazla antes siguiendo [ACTUALIZAR-PERFILES.md](ACTUALIZAR-PERFILES.md). No vuelvas a ejecutar el archivo 001 sobre tu instalación actual.

La actualización crea automáticamente el espacio privado de archivos y sus permisos. No tienes que crear un espacio público ni cambiar claves de Vercel.

Abre una ficha de experimento, aprendizaje o GOI Tree. En **Archivos y enlaces** puedes añadir imágenes JPG, PNG, WebP o GIF, PDF y DOCX, hasta 10 MB por archivo, o enlaces http/https con un nombre opcional. En una ficha nueva, pulsa **Guardar ficha** primero: se abrirá para añadir sus adjuntos. En una ficha existente, se guardan inmediatamente al añadirlos, de forma independiente a sus campos de texto.

Las imágenes muestran miniaturas que puedes abrir. Los PDF permiten abrir una vista previa dentro de la ficha. Los DOCX se abren o descargan para leerlos en Word u otra aplicación compatible. Los enlaces aparecen como accesos clicables.

Los miembros de la empresa pueden consultar los adjuntos. Sus administradores y editores pueden añadirlos y retirarlos. Un lector no puede modificarlos. Cada adjunto pertenece a una ficha y conserva el proyecto de esa ficha.

Al eliminar una ficha o empresa se retiran sus adjuntos. La aplicación borra los archivos a continuación; si se interrumpe la limpieza, la reintenta al iniciar sesión o recargar. Los adjuntos retirados ya no aparecen en las fichas.

La demostración conserva sus archivos solo durante la sesión. Los archivos reales se guardan en Supabase.
