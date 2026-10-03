# Experimental OS

Aplicación multiusuario para gobernar la experimentación de una empresa. Código Next.js + TypeScript, desplegable en Vercel; Supabase aporta autenticación y PostgreSQL.

## Qué incluye

- North Star por empresa, con definición, momento de valor, fuente, frecuencia y medición manual.
- GOI Tree desplegable: North Star → Goals → Oportunidades → Ideas → Experimentos. Hasta cinco oportunidades prioritarias.
- Objetivos y Key Results por periodo. Cada KR puede vincularse a un Goal; cada experimento puede contribuir a varios KR.
- Proyectos con contacto, Growth Manager, foco de funnel y enlaces de trabajo.
- Backlog y priorización ICE: impacto × confianza × facilidad. Escalas procedentes de la hoja compartida.
- Experiment Brief: champion, contexto, hipótesis, control/variantes, audiencia, tráfico, métrica primaria, secundarias, guardrails, muestra, criterios, riesgos, mitigación, analista, plazos y planes de decisión.
- Registro de variantes A/B/C o más, sus resultados y evaluación. Tasas descriptivas para conversiones binarias, sin inferir significancia estadística.
- Repositorio de aprendizajes con resultado, conclusión, decisión, siguientes pasos y búsqueda por texto/etiquetas.
- Registro y acceso por email/contraseña, confirmación de email según configuración y recuperación de contraseña.
- Empresas privadas, propietario/editor/lector, invitaciones revocables de un solo uso (7 días), cambios de rol y retirada de acceso.
- Historial inmutable para usuarios de la aplicación. El servidor asigna el autor real de las modificaciones.
- Protección ante ediciones concurrentes del mismo registro: se requiere actualizar antes de sobrescribir una versión modificada por otra persona.
- Exportación JSON de los registros. Refresco manual de datos compartidos.

## Arranque local

Requiere Node.js 22.10+ (se verificó con Node.js 24) y npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Sin variables Supabase aparece una **demostración interactiva con datos ficticios**. Los cambios se conservan únicamente en memoria y se pierden al recargar. No hay cuentas ni persistencia real en este modo. Los datos demo nunca se insertan en Supabase.

## Activar el modo multiusuario

1. Crea un proyecto Supabase nuevo. Este esquema utiliza nombres genéricos como `profiles` y `records`; no lo ejecutes en una base existente de Greenhunt sin revisar posibles colisiones.
2. En SQL Editor ejecuta una vez el contenido completo de `supabase/migrations/001_initial.sql`. La migración incluye tablas, RLS, validación, auditoría y funciones de invitación. Si falla, corrige el error antes de habilitar la aplicación; no publiques tablas sin RLS.
3. Copia Project URL y la clave pública anon/publishable en `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA
```

La clave pública es parte del cliente; la seguridad reside en RLS. **No uses `service_role`, secret keys o credenciales de PostgreSQL en variables `NEXT_PUBLIC_*`.**

4. En Authentication → URL Configuration establece Site URL al dominio de producción y añade Redirect URLs para ese dominio y `http://localhost:3000/**`. Autoriza las URLs de confirmación e invitación según la sintaxis de Supabase, por ejemplo `https://tu-app.vercel.app/**` para tu propio dominio. No añadas un comodín global para dominios ajenos.
5. Activa el proveedor Email. Mantén la confirmación de email si deseas verificar las cuentas. Configura SMTP para entrega fiable fuera de las restricciones del servicio de email de prueba de Supabase.
6. Reinicia la aplicación. Crea tu cuenta, confirma el email y crea la empresa.
7. Define North Star → Goals → Oportunidades → Ideas. Añade OKR y proyectos cuando corresponda.
8. En Equipo genera una invitación de editor o lector. Compártela con la persona deseada. La app no envía emails de invitación: ofrece un enlace para copiar. La persona registra su propia cuenta y pega el código/enlace en el formulario para unirse.

## Desplegar en Vercel

1. Descomprime este proyecto y sube su contenido a un repositorio GitHub privado. Incluye `package-lock.json`. Excluye `.env.local`, `.next` y `node_modules`.
2. Importa el repositorio en Vercel. Framework Preset: **Next.js**. Si el repositorio contiene la carpeta `experimental-os`, selecciona esa carpeta como Root Directory; si subiste su contenido a la raíz, deja Root Directory vacío.
3. Install Command: `npm ci`. Build Command: `npm run build`. Output Directory: predeterminado de Next.js; no configures `out` ni `dist`.
4. Añade las dos variables `NEXT_PUBLIC_SUPABASE_*` en Production. Añádelas también en Preview si esas previews deben usar Supabase; para desarrollo es preferible un proyecto Supabase separado.
5. Despliega y registra el dominio final en Supabase Auth, tal como indica el apartado anterior.
6. Cuando cambies una variable `NEXT_PUBLIC_*`, haz un nuevo despliegue: Next.js la incorpora al bundle durante el build.

## Primer experimento

1. Crea una Idea dentro de una Oportunidad respaldada por evidencia.
2. Desde su ficha o el árbol crea un experimento.
3. Completa el brief, champion, métrica, valor inicial, objetivo, criterio, fechas, audiencia y riesgos. Para un A/B aleatorizado configura dos variantes que sumen 100% de tráfico.
4. Vincula proyecto y KR pertinentes. Asigna una persona para analizar.
5. Cambia a **En curso**. Ejecuta el test en la herramienta correspondiente (producto/PostHog, Ads, email, etc.). Esta app no asigna usuarios ni altera campañas.
6. Registra los datos y enlaza la evidencia. Cambia a **En análisis**.
7. Documenta resultado, conclusión, aprendizaje y decisión para marcar **Finalizado**. Registra siguientes pasos y etiquetas.

No confundas el avance de un Goal o KR con impacto causal de un experimento. La app no suma los resultados de los tests a la North Star ni los atribuye automáticamente. Tampoco calcula potencia, intervalos de confianza o p-valores.

## Fuentes y decisiones de adaptación

Leídas el 3 de octubre de 2026:

1. [Guía North Star Metric](https://producthackers.com/es/blog/guia-north-star-metric/): métrica de valor, definición, frecuencia y métricas de entrada.
2. [Qué es GOI Tree](https://producthackers.com/es/blog/que-es-goi-tree/): Goals, Opportunities, Ideas, Experiments; árbol desplegable, evidencia y hasta cinco oportunidades seleccionadas.
3. [Plantilla de aprendizajes](https://docs.google.com/document/d/15p9nczRCVR5-o0S0Dr1zaAOcJoLsz35B4tLvD71FY24/edit): contexto, champion, hipótesis, resultado, aprendizaje, próximos pasos y etiquetas.
4. [Experiment Brief](https://docs.google.com/document/d/1k6y4MrZMCLMdAy9ldtbpFoJeXS5YuMJJxsyQT6hJ76g/edit): diseño, audiencia, reparto, métricas, guardrails, riesgos, análisis y decisión.
5. [Growth Plan Template](https://docs.google.com/spreadsheets/d/1PEyxWM5RNL4rRzcIz8ehBPCAJGVwwGZgEjXpWpFf62o/edit?gid=1171375705): se revisaron Project, Ideas, Prioritization, Experiments y Guía Rápida de uso. La fórmula ICE en Prioritization es `H2*I2*J2`. Se trasladan sus escalas y los campos por variante a la app. La hoja conserva ejemplos A/B/C; no se importan como resultados reales.

La relación de OKR con Goals, los roles de acceso, los estados y las validaciones son decisiones de esta implementación. No se ha leído el libro completo y no se afirma que este código reproduzca toda su metodología. Las etapas del Product Hackers Canvas permanecen editables; no se impone un funnel inventado.

## Modelo y seguridad

`records` guarda nodos tipados con campos específicos en JSONB. Las relaciones del árbol, responsables y Goals tienen claves foráneas dentro de la empresa. Un trigger comprueba referencias a proyectos/KR, analistas, prioridades, variantes y reglas de lanzamiento/cierre. `audit_log` conserva la identidad de quien modifica y las versiones anterior/nueva. Las políticas RLS usan la pertenencia de la sesión autenticada; registrarse no concede acceso a una empresa existente.

Solo el propietario administra acceso. Al retirar un miembro se desasignan sus responsabilidades actuales, se conserva el historial y se impide que lea o edite los registros de esa empresa. La cuenta puede seguir perteneciendo a otras empresas.

La auditoría es inmutable para el cliente, no para un administrador con acceso directo a la base. El proyecto necesita las copias de seguridad y operación habituales de Supabase.

## Verificación

```bash
npm run typecheck
npm test
npm run build
```

Las pruebas SQL ejecutan la migración en PostgreSQL embebido (PGlite), simulando `auth.uid()` y los roles de Supabase. Cubren aislamiento entre empresas, lector/editor, atribución de acciones, invitaciones usadas/caducadas y reglas de lanzamiento/cierre. PGlite ya ofrece `gen_random_uuid`; en ese test se omite únicamente la sentencia de instalación de `pgcrypto`.

La autenticación por email, SMTP y el despliegue real requieren un proyecto Supabase y una cuenta Vercel. No se han conectado servicios de producción ni enviado correos durante la construcción. No se ha ejecutado QA visual de navegador en este entorno.

## Límites de V1

- Entrada manual de métricas y resultados; enlaces externos e identificadores preparados para futuras integraciones. Sin sincronización automática de PostHog, Meta Ads, Amplitude o email.
- Un propietario inicial por empresa; sin transferencia de propiedad desde la interfaz.
- No hay importación del JSON exportado, adjuntos, comentarios ni automatización de campañas.
- El árbol tiene los cinco niveles principales del artículo. No incluye sub-Goals recursivos; esa ampliación puede añadirse tras probar el modelo con el equipo.
- Un tool WebMCP de lectura se registra solo en navegadores compatibles. El funcionamiento del registro no se ha verificado en un navegador con WebMCP; no es necesario para utilizar la aplicación.
