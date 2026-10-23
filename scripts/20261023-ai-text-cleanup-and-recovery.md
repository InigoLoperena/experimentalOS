# Xperiments — limpieza de textos automáticos (23 octubre 2026)

## Regla de producto

Las fichas nuevas empiezan sin texto copiado de padres o generado por la IA. Solo se rellenan cuando una persona escribe o solicita a la IA una propuesta y después pulsa explícitamente «Rellenar formulario para revisar» o «Revisar y crear experimento» y guarda su revisión. Relaciones padre-hijo, opciones de select y puntuaciones ICE iniciales son metadatos de formulario, no texto redactado por IA.

## Limpieza de datos ya efectuada en Supabase

La limpieza de 2026-10-23 se ejecutó directamente en Supabase y **no debe volver a ejecutarse automáticamente** durante un despliegue. Solo se quitaron campos marcados como ejemplo o cargados sin autor, preservando campos modificados desde una cuenta de usuario y títulos provenientes de indicaciones directas. Nunca se eliminaron las fichas ni sus relaciones.

## Backups privados verificados

Estas tablas existen en el esquema **experimental_private**, que no debe exponerse en la API pública:

- `experimental_private.record_text_cleanup_backup_20261023` — 47 fichas **antes** de la limpieza, con sus campos y títulos originales.
- `experimental_private.records_full_backup_20261023` — 81 fichas **después** de la limpieza.
- `experimental_private.record_audit_backup_20261023` — 795 entradas históricas de auditoría.

Todas se crearon con copia puntual; no son tablas de sincronización. No borrar ni mover al esquema `public`. Consultar sus filas y el historial para recuperar únicamente campos seleccionados, nunca restaurar toda la tabla `records` sin evaluación previa de escrituras recientes y de las relaciones.

## Consultas no destructivas de verificación

```sql
select count(*) from experimental_private.record_text_cleanup_backup_20261023;
select count(*) from experimental_private.records_full_backup_20261023;
select count(*) from experimental_private.record_audit_backup_20261023;
```

El resguardo en Supabase es independiente del código desplegado mediante GitHub y Vercel. El UI puede cargar la nueva política sin repetir la limpieza SQL.
