# Activar los perfiles y la gestión de la empresa

**Esta guía corresponde a una versión anterior.** La aplicación actual mantiene los perfiles personales y la gestión de usuarios en Equipo, y retira los perfiles de empresa. Después de la 003 y la 004, sigue [ACTIVAR-EQUIPO-INTERNO.md](ACTIVAR-EQUIPO-INTERNO.md) para aplicar la 005.

El código se actualiza automáticamente mediante GitHub y Vercel. Para guardar nombres, fotos y datos de la empresa, hace falta esta actualización de tu base de datos, una sola vez.

1. Abre tu proyecto en [Supabase](https://supabase.com/dashboard).
2. En el menú izquierdo entra en **SQL Editor** y pulsa **New query** (nueva consulta).
3. Abre [003_profiles_and_company.sql en GitHub](https://github.com/InigoLoperena/experimentalOS/blob/main/supabase/migrations/003_profiles_and_company.sql). Pulsa **Raw** y copia **todo** el contenido. Pégalo en la nueva consulta de Supabase.
4. Pulsa **Run** (ejecutar). Cuando aparezca el mensaje de éxito, recarga Experimental OS.

Si todavía no ejecutaste la actualización anterior `002_project_growth_tree.sql`, ejecútala primero siguiendo [ACTUALIZAR-SUPABASE.md](ACTUALIZAR-SUPABASE.md). **No vuelvas a ejecutar `001_initial.sql` sobre tu instalación actual.**

Esta actualización no elimina tus datos. Prepara los campos y permisos para las nuevas funciones; no necesitas cambiar claves, configurar emails ni crear un espacio para fotos.

Para probarlo: pulsa **Mi perfil** y guarda tu nombre o una foto. Después entra en **Equipo**, donde el administrador de la empresa puede editar nombre, web y logo. La persona que creó la empresa tiene ese permiso.

**Eliminar empresa** es una acción aparte: pide escribir su nombre y borra definitivamente todos los datos de esa empresa. Las cuentas personales y las otras empresas se conservan. No uses esa opción para comprobar si la actualización se ejecutó correctamente.
