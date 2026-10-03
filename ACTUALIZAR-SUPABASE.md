# Activar los cambios en tu web

El código se actualiza desde GitHub y Vercel. Para guardar los datos por proyecto hay que actualizar también Supabase. Solo necesitas hacerlo una vez.

## 1. Actualizar la base de datos

1. Abre en este repositorio el archivo [002_project_growth_tree.sql](supabase/migrations/002_project_growth_tree.sql).
2. Pulsa **Raw** para ver solo su contenido. Selecciona todo el texto y cópialo.
3. Entra en [Supabase](https://supabase.com/dashboard) y abre el proyecto que utiliza Experimental OS.
4. En el menú izquierdo abre **SQL Editor**, crea una consulta nueva y pega todo el texto.
5. Pulsa **Run** y espera a que aparezca el mensaje de ejecución correcta. Si aparece un error, copia el mensaje y compártelo para resolverlo.

**No ejecutes otra vez `001_initial.sql`.** Esta actualización conserva las cuentas, las empresas, los registros y su historial. Los datos antiguos se asignan al primer proyecto que ya existía. Si no había ninguno, aparecerán en un proyecto llamado **Proyecto inicial**. Los aprendizajes anteriores se copian a la sección Aprendizajes.

Vercel no ejecuta este SQL automáticamente. Hasta completarlo, la web indica que la actualización está pendiente y bloquea crear o editar fichas.

## 2. Registrar cuentas sin confirmación de email

1. En Supabase abre **Authentication → Sign In / Providers → Email**.
2. Mantén activado el acceso por Email.
3. Desactiva **Confirm email** y guarda con **Save**.

Una cuenta nueva entra directamente al registrarse. No necesitas configurar un envío de confirmaciones. El nombre se conserva para identificar a la persona; el formulario sigue pidiendo nombre, email y contraseña.

## 3. Comprobar la web

1. Recarga la web o pulsa el botón de actualizar datos.
2. En **Proyectos**, abre tu proyecto existente o crea uno nuevo.
3. En **Experimentos**, **Aprendizajes** y **Growth Tree**, cambia el selector Proyecto: cada uno muestra sus propios datos.
4. Registra una cuenta nueva en una ventana privada. Debe abrir la sesión sin pedirte revisar el email.

En tu ordenador, usa **Fetch origin** y después **Pull origin** en GitHub Desktop para descargar los cambios de GitHub a tu carpeta local.
