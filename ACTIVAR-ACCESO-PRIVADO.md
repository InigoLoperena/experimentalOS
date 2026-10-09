# Activar el acceso privado del equipo

El despliegue de Vercel publica código; no ejecuta las migraciones de Supabase. La clave pública de la app tampoco permite administrar la base de datos.

## Instalación existente

1. Abre el proyecto correcto de Supabase y revisa las migraciones ya aplicadas.
2. Aplica solo las pendientes por orden. La 010 requiere las migraciones 001–009; no vuelvas a ejecutar las anteriores si ya están aplicadas.
3. Ejecuta `supabase/migrations/010_private_team_access.sql` en SQL Editor o mediante el flujo de migraciones de Supabase.
4. Verifica que un miembro existente sigue entrando, que una cuenta sin invitación muestra «Acceso al equipo» y que un visitante público no obtiene adjuntos ni enlaces de adjuntos.
5. Comprueba que un lector puede abrir los archivos del equipo, pero no añadirlos ni retirarlos. Comprueba que un editor sí puede hacerlo.

La migración conserva identificadores, miembros, proyectos y archivos. Revoca la creación de equipos desde la app, elimina la política de lectura anónima de archivos y retira los metadatos de adjuntos del RPC público. No cambia contraseñas ni ajustes de autenticación.

## Instalación nueva sin ningún equipo

Después de aplicar 001–010, registra la cuenta del administrador y confirma su email si la configuración lo requiere. En Authentication → Users copia el identificador de esa cuenta.

Un administrador de Supabase puede ejecutar lo siguiente en SQL Editor, sustituyendo `UUID_DEL_ADMINISTRADOR` por el identificador elegido. El bloque se niega a crear otro espacio si ya existe uno.

```sql
do $$
declare
  administrator uuid := 'UUID_DEL_ADMINISTRADOR'::uuid;
  team uuid;
begin
  perform pg_advisory_xact_lock(782631010);
  if exists(select 1 from public.workspaces) then
    raise exception 'Ya existe un espacio. Conserva sus miembros e invita desde el equipo.';
  end if;
  if not exists(select 1 from auth.users where id=administrator) then
    raise exception 'La cuenta elegida no existe.';
  end if;
  insert into public.workspaces(name,created_by)
  values('Equipo interno',administrator) returning id into team;
  insert into public.members(workspace_id,user_id,role)
  values(team,administrator,'owner');
end $$;
```

Recarga la app y usa **Equipo** para generar invitaciones. No ejecutes este bloque para una instalación existente.

## Confirmación de email e invitaciones

Autoriza el dominio real de la app en Authentication → URL Configuration. Para probar localmente, autoriza también la dirección utilizada, por ejemplo `http://127.0.0.1:3000/**`. La invitación se conserva en el destino del correo de confirmación. Si los correos no llegan, revisa el proveedor SMTP y sus registros. El comportamiento de registro con y sin sesión está documentado en [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup).
