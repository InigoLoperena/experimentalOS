# Cuentas del espacio de trabajo

Cada proveedor se configura una vez por workspace. Los experimentos, campañas,
archivos y resultados conservan su proyecto y workspace originales. El administrador
del equipo configura sus conexiones; los colaboradores ven el mismo panel en modo
consulta, según los permisos existentes.

## Resolución y compatibilidad

- `workspaceConnection` prioriza la cuenta con `workspace_default`, después una
  conexión con `project_id = null`. Una cuenta común desactivada bloquea su uso,
  sin cambiar automáticamente a credenciales antiguas.
- Las conexiones antiguas únicas se comparten conservando su ID, configuración y
  cifrado. Si hay varias, el administrador elige cuál usar; no se adivina la cuenta.
- Al guardar desde el nuevo panel, los secretos se descifran en el servidor usando
  su vinculación original y se vuelven a cifrar con `project_id = null`. La cuenta
  común sobrevive a la eliminación del proyecto de origen. Las filas antiguas se
  conservan y los perfiles se vinculan a la nueva cuenta.
- Los clientes antiguos siguen pudiendo leer/configurar sus filas por proyecto
  durante la transición. No constituyen la opción de configuración del nuevo panel.

## Perfiles sin duplicar secretos

`integration_project_profiles` contiene solamente identificadores públicos:
marca/blogId de Metricool, proyecto/región de PostHog, píxel de Meta, app de iOS o
paquete Android. Todas las referencias pertenecen al mismo workspace y proveedor.
La clave se obtiene siempre de la cuenta común antes de combinar el perfil.
Metricool verifica el acceso a la marca seleccionada; PostHog verifica el proyecto.
Los identificadores de PostHog ya guardados en proyectos siguen teniendo prioridad
si no existe un perfil explícito, para conservar la atribución de sus datos.

Las APIs de App Store, Google Play, LinkedIn y TikTok conservan su nivel actual de
implementación. Compartir su configuración no implementa operaciones pendientes.

## Validación

Pruebas de migración y servidor cubren preservación del cifrado, aislamiento entre
equipos, configuración exclusiva del owner, acceso de consulta de colaboradores,
actualizaciones obsoletas, selección de perfiles, desactivación y supervivencia de
la cuenta común al borrar su proyecto de origen. Google Ads admite una cuenta de
servicio (JSON privado) o las credenciales OAuth existentes, guardadas una vez por
equipo. La cuenta técnica requiere acceso Estándar en Google Ads y su proyecto
Cloud necesita un nivel API válido para la cuenta real. Una sesión en Ads Manager
no constituye una conexión API. El intercambio JWT fija el destino, alcance y
audiencia de Google y no permite suplantación de usuarios desde el JSON importado.
