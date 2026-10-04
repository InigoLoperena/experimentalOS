# Activar el equipo interno

Experimental OS funciona como una herramienta interna de Imagine Builder. Ya no hay perfiles, creación, selección ni eliminación de empresas. Se mantienen los proyectos, registros, archivos, cuentas, permisos e historial existentes.

## Si ya estás usando la aplicación

1. Abre tu proyecto en Supabase.
2. En el menú izquierdo, entra en **SQL Editor** y pulsa **New query**.
3. En GitHub abre [005_internal_team.sql](supabase/migrations/005_internal_team.sql), pulsa **Raw** y copia todo su contenido.
4. Pégalo en la nueva consulta de Supabase y pulsa **Run**.
5. Cuando aparezca **Success**, recarga la aplicación.

**No vuelvas a ejecutar `001_initial.sql`.** Las migraciones 001 a 004 deben estar aplicadas antes de esta actualización. GitHub y Vercel despliegan el código; no ejecutan consultas en tu base de Supabase.

La actualización reutiliza el primer espacio creado y conserva sus administradores, miembros, proyectos e historial. Si creaste varios espacios antiguos, se usa el más antiguo; los demás datos se conservan en Supabase, sin borrarlos ni mezclarlos automáticamente. Mientras aplicas esta actualización, los miembros existentes pueden seguir trabajando con sus datos.

## Cómo entra el equipo

- El administrador abre **Equipo**, elige Editor o Lector y pulsa **Crear enlace**.
- Comparte ese enlace con la persona. Cada enlace sirve para una persona y caduca en siete días.
- La persona crea su cuenta con nombre, email y contraseña, o inicia sesión si ya tiene una. La sesión se abre automáticamente si Confirm email está desactivado en Supabase.
- Pulsa **Acceder al equipo** para aceptar la invitación. No se le pide crear ninguna empresa.
- El administrador puede cambiar permisos o retirar el acceso desde Equipo. La cuenta personal y la atribución de las acciones se conservan. Una cuenta sin invitación no puede leer los datos del equipo.

## Una instalación nueva

Ejecuta las migraciones 001, 002, 003, 004 y 005, en ese orden, y configura Supabase como indica el README. La primera persona que acceda crea automáticamente el único equipo interno y queda como administradora, sin completar ningún formulario de empresa. Después invita al resto desde Equipo.
