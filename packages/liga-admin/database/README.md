# ⚠️ Carpeta Deprecada

Esta carpeta ya no se usa. Los scripts SQL de migración ahora se gestionan con **Supabase CLI**.

## Nueva Ubicación

Las migraciones de base de datos ahora están en:
```
supabase/migrations/
```

## Cómo Crear Migraciones

```bash
# Crear nueva migración
supabase migration new nombre_descriptivo

# Aplicar migraciones localmente
supabase db reset

# Aplicar migraciones a producción
supabase db push
```

## Documentación

Ver [specs/05-database-migrations.md](../specs/05-database-migrations.md) para instrucciones completas.
