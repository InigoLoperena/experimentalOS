# Guardar una ficha de ChatGPT en Xperiments

## Recorrido

El servidor MCP público `POST /api/mcp` ofrece `prepare_experiment_save`.
Valida una ficha (nombre, contexto, hipótesis, métrica y criterio de éxito;
fecha, etiquetas e ICE opcionales), y prepara un enlace de revisión.
La respuesta es `pending_confirmation`, `saved: false`. No se presenta como
guardado ni consulta proyectos, usuarios o documentos privados.

El usuario abre `/plugins/validacion-de-negocios/guardar#draft=…`, inicia
sesión en la app si hace falta, elige proyecto y pulsa «Confirmar y guardar».
La web consulta `POST /api/plugin/experiments` con su JWT de Supabase;
se aplican la pertenencia al espacio, `experiments.create` y las políticas RLS.
La ficha se inserta en `records`, `kind=experiment`, sin activar proveedores.
No se crea otro backend ni se modifica el esquema de datos.

## Protección y límites

- Clave independiente `MCP_DRAFT_ENCRYPTION_KEY`: 32 bytes aleatorios en hex,
  exclusivamente en el servidor; Vercel la guarda como Secret. No incluirla
  en un ZIP, código fuente o variable pública. Rotarla invalida enlaces pendientes.
- Borrador AES-256-GCM, clave derivada mediante HKDF y propósito separado;
  vencimiento de 30 minutos; contenido total UTF-8 limitado a 6500 bytes.
- El borrador viaja cifrado en el fragmento; no se guarda en la base de datos
  antes de confirmar. Quien tenga el enlace puede revisar ese borrador al
  iniciar sesión, pero solo guardarlo en proyectos de su propia cuenta.
- El código no registra cuerpos, borradores ni enlaces en los logs.
- Guardado idempotente por borrador/cuenta mediante UUID determinista:
  reintentos simultáneos no duplican; cambiar de proyecto tras guardar da conflicto.
- El servidor MCP es público y solo prepara fichas. El guardado está autenticado;
  no requiere delegar acceso permanente u OAuth. ChatGPT no recibe la sesión
  ni la lista de proyectos, y no recibe confirmación automática del paso web.
- Sin otra llamada a OpenAI, almacenamiento temporal externo o plan de pago.
  Se consumen las cuotas existentes de Vercel y Supabase.

## Pruebas

`tests/plugin-save.test.ts` verifica cifrado, autenticidad, vencimiento, límites,
identidades no admitidas, permisos, reintentos/colisiones y el protocolo MCP.
Las pruebas existentes de SQL verifican el aislamiento y las restricciones de
creación de `records`. Antes de publicar se debe probar también con una sesión
real: preparar ficha, revisar, guardar, leer el registro en Supabase y limpiar
la prueba sintética. No usar datos de clientes para las pruebas de revisión.

## Complemento y publicación

El ZIP público debe conservar solo los tres libros y guías generales, agregar
la habilidad de guardado y conectar el endpoint mediante `mcp.json`.
El paquete privado original no cambia. La modalidad pública es «With MCP»;
preparar un ZIP o desplegar este servidor no equivale a publicación aprobada.
La revisión pública requiere sus casos de prueba, demostración real y los
pasos de verificación/atestaciones del portal. Si la demostración no se ha
grabado, declararla pendiente: no sustituirla por un guion o capturas.
