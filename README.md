# Experimental OS

Herramienta interna de Imagine Builder para organizar la experimentación por proyectos, con cuentas individuales y un único equipo compartido. Next.js + TypeScript, GitHub y Vercel; Supabase aporta cuentas, sesiones y base de datos.

## Navegación

- **Experimentos:** fichas sencillas con búsqueda por nombre, responsable, hipótesis y etiquetas.
- **Proyectos:** crear y editar proyectos y abrir su GOI Tree.
- **Aprendizajes:** documentación separada del experimento, con resultados, evidencia, conocimiento y siguientes pasos.
- **Equipo:** usuarios, roles e invitaciones, sin perfiles de empresa.
- **GOI Tree:** North Star → Goals y sub-Goals → Oportunidades → Ideas → Experimentos.
- **Cómo utilizar Experimental OS:** explicaciones breves y enlaces a las fuentes.

Experimentos, Aprendizajes y GOI Tree tienen un selector común de proyecto. Al cambiarlo, solo aparecen los registros de ese proyecto. Cada proyecto tiene una North Star propia y puede destacar un máximo de cinco oportunidades. No se permiten padres de otro proyecto, ciclos en el árbol ni traslados de registros entre proyectos. Los miembros del equipo mantienen sus roles en todos los proyectos.

El árbol es desplegable. Los Goals son métricas de entrada que pueden influir en la North Star y admiten sub-Goals. Las oportunidades documentan problemas reales o mejoras por aprovechar. Las ideas conservan contexto, evidencia, KPI, etapa del Product Hackers Canvas y priorización ICE. Una idea puede originar varios experimentos. El orden de ejecución se muestra dentro de GOI Tree usando impacto × confianza × facilidad.

## Ficha de experimento

Incluye nombre, responsable, contexto, hipótesis, métrica principal, criterio de éxito, métricas secundarias que pueden verse afectadas, audiencia, asignación de tráfico, riesgos, fecha de inicio, impacto, confianza, facilidad y etiquetas. Las pruebas y materiales se añaden aparte en **Archivos y enlaces**.

El proyecto se toma del selector de la vista; no es otro campo del formulario. Si el experimento se crea desde una idea del árbol, su vínculo se conserva automáticamente. También se pueden crear experimentos independientes desde su lista.

No incluye estados, canal, variantes, muestras, conversiones, resultados, analista, costes, fecha final ni vínculos a OKR. La asignación de tráfico se documenta en texto; esta aplicación no ejecuta tests ni hace análisis estadístico.

Para documentar lo descubierto, abre el experimento y pulsa **Documentar aprendizaje**. El aprendizaje se guarda en una ficha separada dentro del mismo proyecto; también puede crearse directamente en Aprendizajes.

## Archivos y enlaces

Las fichas de experimentos, aprendizajes, North Star, Goals, oportunidades e ideas admiten imágenes JPG, PNG, WebP y GIF, PDF, DOCX y enlaces http/https. Las imágenes muestran miniaturas; los PDF tienen vista previa y los DOCX se pueden abrir o descargar. Máximo 10 MB por archivo. Guarda una ficha nueva para añadir sus adjuntos; los adjuntos de una ficha existente se guardan inmediatamente y pueden retirarse con confirmación.

Los archivos se guardan en un espacio privado de Supabase Storage, con enlaces temporales para visualizar y descargar. Los miembros del equipo pueden leerlos, y solo administradores y editores pueden añadirlos o retirarlos. Los adjuntos heredan el proyecto de la ficha, registran quién los añadió y no alteran los campos de los experimentos. La exportación JSON incluye sus metadatos y rutas; los archivos originales permanecen en Storage.

Ejecuta `supabase/migrations/004_record_attachments.sql` siguiendo [ACTIVAR-ADJUNTOS.md](ACTIVAR-ADJUNTOS.md). La actualización crea el espacio y las políticas de acceso automáticamente. La aplicación reintenta limpiar archivos pendientes al recargar o iniciar sesión.

## Actualizar una instalación existente

Consulta [ACTUALIZAR-SUPABASE.md](ACTUALIZAR-SUPABASE.md).

1. Ejecuta únicamente `supabase/migrations/002_project_growth_tree.sql` en SQL Editor de tu proyecto Supabase. **No vuelvas a ejecutar `001_initial.sql`.**
2. Desactiva **Confirm email** en Authentication → Sign In / Providers → Email y guarda. Al registrarse, Supabase devuelve la sesión y la aplicación abre el acceso automáticamente.
3. GitHub/Vercel despliegan el código; la migración de Supabase se ejecuta por separado.

Para activar los perfiles personales, ejecuta también `supabase/migrations/003_profiles_and_company.sql` después de la actualización anterior. Si ya ejecutaste la 002, solo necesitas ejecutar la 003. Tienes los pasos en [ACTUALIZAR-PERFILES.md](ACTUALIZAR-PERFILES.md).

La migración conserva los registros y el historial. Agrupa los datos antiguos en el primer proyecto existente; si no había proyecto, crea «Proyecto inicial». Copia los resultados y aprendizajes de los experimentos antiguos a fichas de aprendizaje separadas. Los campos antiguos del experimento se conservan en la base hasta la siguiente edición, cuando se retiran de la ficha activa y quedan en el historial de auditoría.

Si el código se despliega antes de ejecutar la migración, la aplicación muestra que la actualización está pendiente y bloquea la creación y edición de fichas. Los datos siguen guardados. Cuando termines la actualización, pulsa Actualizar datos o recarga la página.

## Instalar desde cero

1. Crea un proyecto Supabase nuevo. No ejecutes este esquema sobre una base de otra aplicación.
2. En SQL Editor ejecuta, por orden, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_project_growth_tree.sql`, `supabase/migrations/003_profiles_and_company.sql`, `supabase/migrations/004_record_attachments.sql` y `supabase/migrations/005_internal_team.sql`.
3. Configura estas variables con Project URL y la clave pública anon/publishable:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA
```

Nunca uses `service_role`, una clave secreta o credenciales de PostgreSQL en variables públicas.

4. Activa Email y desactiva Confirm email en Supabase Auth. No necesitas SMTP para registrar cuentas. La recuperación de contraseña sigue utilizando emails y puede requerir configurar SMTP propio.
5. En Authentication → URL Configuration establece Site URL al dominio de producción y autoriza las Redirect URLs de recuperación para ese dominio. Para desarrollo puedes añadir `http://localhost:3000/**`; evita comodines que incluyan dominios ajenos.
6. Importa el repositorio en Vercel como Next.js. Install Command: `npm ci`; Build Command: `npm run build`; Output Directory: predeterminado. Añade las dos variables anteriores en Production y, si corresponde, en Preview.
7. Crea tu cuenta: el único equipo interno se inicializa automáticamente y quedas como administrador. Crea tu primer proyecto e invita al resto de personas desde Equipo. Después configura su North Star y construye su GOI Tree.

Los cambios de variables `NEXT_PUBLIC_*` requieren un nuevo despliegue.

## Perfiles y administración

Pulsa el icono **Mi perfil** de la barra superior o **Editar mi perfil** junto a tu nombre para cambiar tu nombre y foto. Se aceptan imágenes JPG, PNG o WebP de hasta 5 MB; la aplicación las reduce y las guarda sin configurar otro servicio. Los nombres de las acciones antiguas se conservan en el historial.

En **Equipo**, el administrador puede invitar a personas, cambiar su rol de Editor/Lector y retirar su acceso. Las cuentas y la atribución de sus acciones se conservan. Una persona que crea su cuenta mantiene la sesión abierta, pero necesita una invitación para consultar los datos internos. No puede crear otra empresa. Los permisos también se comprueban en Supabase.

Ejecuta una vez `supabase/migrations/005_internal_team.sql` después de las migraciones anteriores. Sigue [ACTIVAR-EQUIPO-INTERNO.md](ACTIVAR-EQUIPO-INTERNO.md). Se reutiliza el primer espacio existente sin borrar proyectos, registros, archivos ni miembros. Los miembros existentes pueden seguir trabajando mientras se aplica la actualización; se eliminan las operaciones de empresa en la base al ejecutar la 005. En una instalación nueva, el primer acceso crea el equipo automáticamente.

## Identidad visual

El logo original de Imagine Builder y el título Experimental Operative System identifican la herramienta. Toda la interfaz usa fondos grises oscuros, texto claro, verde fosforito para acciones principales y títulos, azul para ideas/información y rojo para oportunidades/avisos. Tarjetas, tablas, filtros, formularios, perfiles personales, acceso y ventanas comparten la misma paleta, también en móvil.

## Desarrollo y verificaciones

Requiere Node.js 22.10+ y npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Sin variables Supabase aparece una demostración con datos ficticios. Sus cambios solo duran durante esa sesión y nunca se insertan en la base real.

```bash
npm run typecheck
npm test
npm run build
```

Las pruebas PostgreSQL usan PGlite y cubren migración de datos antiguos, North Stars independientes por proyecto, sub-Goals, rechazo de ciclos y enlaces entre proyectos, máximo de cinco oportunidades por proyecto, registro de identidad, roles de acceso e invitaciones. La autenticación y el despliegue real requieren los servicios configurados.

## Fuentes

- [GOI Tree · Product Hackers](https://producthackers.com/es/blog/que-es-goi-tree/): niveles, requisitos, sub-Goals, documentación, oportunidades prioritarias y orden de ejecución.
- [North Star Metric · Product Hackers](https://producthackers.com/es/blog/guia-north-star-metric/).
- [Plantilla de aprendizajes](https://docs.google.com/document/d/15p9nczRCVR5-o0S0Dr1zaAOcJoLsz35B4tLvD71FY24/edit).
- [Experiment Brief](https://docs.google.com/document/d/1k6y4MrZMCLMdAy9ldtbpFoJeXS5YuMJJxsyQT6hJ76g/edit).
- [Growth Plan Template](https://docs.google.com/spreadsheets/d/1PEyxWM5RNL4rRzcIz8ehBPCAJGVwwGZgEjXpWpFf62o/edit?gid=1171375705).

La organización por proyectos, las fichas simplificadas y los roles son decisiones de esta aplicación solicitadas por el equipo. No se ha leído el libro completo. Los datos se miden y documentan manualmente; no hay sincronización automática con herramientas externas.
