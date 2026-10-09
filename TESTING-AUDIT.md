# Auditoría funcional — 9 de octubre de 2026

Repositorio: `InigoLoperena/experimentalOS`. Carpeta comprobada: `C:\Users\ini\Documents\GitHub\experimentalOS`. Base inicial: `0e023d1`. Next.js 16.3.8, Node.js 24.19.

## Alcance y resultados

Se ejecutaron 34 pruebas automáticas, sin fallos ni pruebas omitidas. Incluyen servicios con respuestas controladas y pruebas SQL con PGlite que aplican las diez migraciones completas. Estas últimas validan las políticas y relaciones del esquema en una base aislada; no equivalen a ejecutar escrituras en el Supabase de producción.

También se recorrió la interfaz local mediante automatización del navegador, usando la vista pública en solo lectura y datos ficticios de la demostración. Los datos de prueba de la demostración no se escribieron en Supabase.

La comprobación de tipos y la compilación final de producción terminaron correctamente. Se arrancó la versión compilada y se repitieron las comprobaciones HTTP y de conexión pública a Supabase, también sin fallos.

| Funcionalidad | Comprobación realizada | Resultado / límite |
|---|---|---|
| Navegación | Las seis secciones principales; títulos de Objetivos, Oportunidades e Ideas | Correcto |
| Proyectos | Crear proyecto, definir North Star, cambiar proyecto, separar sus registros | Correcto en demostración; aislamiento SQL probado |
| GOI Tree | Crear primer objetivo, subobjetivo, oportunidad e idea; conservar padres y evidencia | Correcto; ciclos y padres inválidos rechazados por SQL |
| Experimentos | Crear desde idea, heredar contexto y métrica, editar, buscar, calcular ICE | Correcto; fichas antiguas y campos simplificados cubiertos |
| Aprendizajes | Documentar desde experimento y conservar el vínculo | Correcto en demostración y SQL |
| Comentarios | Publicar, cerrar y reabrir; atribución, lectura y permisos SQL; exportación | Correcto; cambios de base requieren las migraciones correspondientes |
| Enlaces y adjuntos | Enlace válido/inválido, persistencia, imagen de prueba y recuperación de su original en ZIP | Correcto en demostración; permisos y cola de eliminación probados en SQL |
| Eliminación | Fichas con permisos denegados, referencias que impiden borrar, proyecto completo y cola de archivos | Correcto en servicios/SQL; no se eliminaron datos reales |
| Equipo | Acceso por invitación de un solo uso, roles, retirada de acceso, conservación de miembros | Probado en SQL; envío/aceptación desde una cuenta real pendiente |
| Perfil | Editar nombre en demostración; validaciones y permisos de perfiles | Correcto; carga real de foto pendiente |
| Registro | Con/sin sesión inmediata, confirmación de email, errores de proveedor/red y destino con invitación | Correcto con proveedor simulado; entrega real de correo pendiente |
| Exportaciones | Descargas CSV, JSON, PDF y ZIP; JSON con dos proyectos y un comentario; original PNG idéntico byte a byte | Correcto; paginación y protección de fórmulas CSV también probadas |
| PostHog | Paginación de más de 100 experimentos; errores, respuestas incompletas, destinos inseguros, concurrencia y preservación de campos locales | Correcto con respuestas simuladas; conexión real pendiente |
| HTTP local | Página 200; PostHog sin sesión y con token inválido 401; método GET 405 | Correcto |
| Supabase público | Auth y RPC de vista pública responden 200; cinco proyectos visibles | Solo lectura; no acredita acceso administrativo |
| Pantalla móvil | Navegación del GOI Tree, anchura CSS observada de 375 px y ausencia de desbordamiento horizontal de página | Correcto en la pantalla comprobada |
| Navegador | Registro de errores durante el recorrido | Ningún error registrado |

## Fallos corregidos

1. Los subobjetivos se guardaban como hijos de North Star, ignorando el objetivo elegido. Ahora conservan su padre.
2. Un proyecto con North Star en sus campos podía intentar guardar el primer objetivo sin un registro padre válido. Ahora se crea o reutiliza la North Star del proyecto, contemplando otro editor concurrente.
3. Los comentarios de demostración desaparecían al reabrir la ficha. Ahora se conservan durante la sesión.
4. Las subpáginas Objetivos, Oportunidades e Ideas tenían encabezados vacíos.
5. La lista de fichas podía truncarse por el límite de filas del servidor. Ahora se consulta con paginación y orden estable.
6. La eliminación consultaba una tabla de adjuntos inexistente y podía retirar archivos antes de comprobar que el borrado de la ficha estaba permitido. Ahora utiliza el borrado de registros y la cola existente de limpieza, posterior al borrado autorizado.
7. La carga de adjuntos se reiniciaba al cambiar la referencia de sus valores en un formulario. Ahora los cambios de campos no reinician esa consulta.
8. Las copias completas omitían comentarios. Ahora los incluyen en JSON, CSV, PDF y ZIP.
9. PostHog consultaba solo la primera página y podía tratar los experimentos siguientes como eliminados. Ahora descarga todas las páginas y rechaza listas incompletas antes de sincronizar. Se preservan campos locales y se detectan modificaciones concurrentes. La API de PostHog documenta la paginación mediante `next` en [su referencia oficial](https://posthog.com/docs/api).
10. La clave privada de PostHog podía enviarse a un host elegido en una ficha. Ahora solo se permiten hosts HTTPS autorizados, se bloquean redirecciones y se validan identificadores y enlaces de paginación. Los hosts propios requieren `POSTHOG_ALLOWED_HOSTS` en el servidor.
11. Las respuestas antiguas de resultados PostHog podían actualizar otra ficha al cambiar de selección. Ahora se descartan las consultas anteriores y se evita iniciarlas simultáneamente.
12. El registro sin sesión inmediata mostraba un error incluso cuando la confirmación de email era el siguiente paso esperado. Ahora muestra el paso pendiente y conserva el destino de la invitación. Este comportamiento se basa en [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup).
13. La apertura del espacio llamaba a RPCs que podían crear equipos automáticamente. Ahora consulta las membresías existentes bajo RLS.
14. La migración 006 permitía lectura pública de adjuntos, contraria a las reglas del repositorio. La nueva 010 retira esa política, los metadatos públicos de adjuntos y el permiso de crear equipos. La app también oculta esos metadatos mientras se actualiza la base.

## Validación reproducible

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Las pruebas se ejecutan en serie para evitar el agotamiento de memoria al arrancar varias bases de prueba a la vez. No necesitan credenciales de producción.

Para comprobar HTTP y los servicios públicos con la app local arrancada:

```bash
node --env-file=.env.local scripts/verify-live.mjs
```

Este comando realiza consultas de solo lectura, no imprime claves ni datos personales. Puede utilizar `TEST_APP_URL` para otro destino explícito de pruebas.

## Pendiente en los servicios reales

- Supabase rechazó la consulta administrativa de migraciones del proyecto `yjnidbgjkobzlmhpzawz`. **No se aplicó ni verificó la migración 010 en ese servicio.** Hay que habilitar una conexión administrativa al proyecto y seguir [ACTIVAR-ACCESO-PRIVADO.md](ACTIVAR-ACCESO-PRIVADO.md). Ocultar adjuntos en la app no sustituye las políticas de base de datos.
- Vercel rechazó consultar `experimental-os` en `inigos-projects-c5a8369f` con 403. No hay una CLI autenticada disponible. La compilación local no confirma el estado de su despliegue ni sus variables.
- Falta una cuenta de pruebas autenticada y un proyecto con datos desechables para completar el recorrido navegador → API → Supabase, incluyendo subir/abrir/retirar archivos privados, roles, invitaciones, cierre de sesión y recuperación de contraseña. No se enviaron correos de prueba ni se modificaron contraseñas reales.
- Falta configurar/verificar `POSTHOG_PERSONAL_API_KEY` en el entorno servidor y los identificadores correctos de PostHog para probar sincronización y resultados reales. La clave debe guardarse en el gestor de variables del servicio, nunca en el chat ni en una variable pública.
- Tras sincronizar GitHub, se debe verificar el despliegue correspondiente y repetir el recorrido autenticado. No se afirma que todas las funcionalidades hayan quedado verificadas en producción.
