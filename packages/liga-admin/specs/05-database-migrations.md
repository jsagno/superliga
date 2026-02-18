# Sistema de Migraciones de Base de Datos

## 1. Estado Actual del Proyecto

### ❌ Problema Actual
```
database/
├── create_extreme_tables.sql      ← Script suelto
├── add_ranking_field.sql          ← Script suelto
├── make_player_b_nullable.sql     ← Script suelto
└── [11 scripts más...]            ← Sin orden, sin historial
```

**Problemas:**
- No hay control de versiones de BD
- Scripts ejecutados manualmente (copy-paste en Supabase Dashboard)
- No se sabe qué migraciones están aplicadas
- Imposible hacer rollback
- No hay entorno de desarrollo local
- Riesgo de ejecutar dos veces la misma migración

### ✅ Solución: Supabase CLI + Migraciones

## 2. Configuración de Supabase CLI

### 2.1 Instalación

```bash
# Instalar Supabase CLI globalmente
npm install -g supabase

# Verificar instalación
supabase --version
```

### 2.2 Inicializar Proyecto

```bash
# Desde la raíz del proyecto
cd d:/LigaInterna/liga-admin

# Inicializar Supabase (crea carpeta supabase/)
supabase init
```

**Resultado:**
```
liga-admin/
├── supabase/
│   ├── config.toml              # Configuración del proyecto
│   ├── seed.sql                 # Datos iniciales
│   └── migrations/              # ⭐ Migraciones versionadas
│       ├── 20260124000001_initial_schema.sql
│       ├── 20260124000002_add_player_dates.sql
│       └── ...
├── database/                    # Scripts viejos (deprecar)
├── src/
└── package.json
```

### 2.3 Conectar con Proyecto Remoto

```bash
# Login a Supabase
supabase login

# Link al proyecto existente
supabase link --project-ref <YOUR_PROJECT_REF>

# Obtener el project-ref desde:
# https://supabase.com/dashboard/project/<project-ref>/settings/general
```

### 2.4 Configurar Variables de Entorno

```bash
# .env.local (crear si no existe)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # Solo para migraciones
```

## 3. Crear Migraciones

### 3.1 Migración desde Cero (Primera Vez)

**Opción A: Pull del Schema Remoto**
```bash
# Descargar schema actual de Supabase a migración local
supabase db pull

# Esto crea: supabase/migrations/TIMESTAMP_remote_schema.sql
```

**Opción B: Crear Manualmente**
```bash
# Crear nueva migración con nombre descriptivo
supabase migration new initial_schema

# Editar: supabase/migrations/TIMESTAMP_initial_schema.sql
```

### 3.2 Crear Nueva Migración

```bash
# Crear migración para nueva feature
supabase migration new add_ranking_field

# Editar el archivo generado
```

**Ejemplo de Migración:**
```sql
-- supabase/migrations/20260124120000_add_ranking_field.sql

-- Add ranking column
ALTER TABLE season_zone_team_player
ADD COLUMN IF NOT EXISTS ranking INTEGER;

-- Add comment
COMMENT ON COLUMN season_zone_team_player.ranking IS 
  'Player ranking position within the zone (1 = highest rank)';

-- Create index
CREATE INDEX IF NOT EXISTS idx_season_zone_team_player_ranking 
ON season_zone_team_player(zone_id, ranking);
```

### 3.3 Aplicar Migraciones

**Desarrollo Local (Docker):**
```bash
# Iniciar base de datos local PostgreSQL
supabase start

# Aplicar migraciones pendientes
supabase db reset

# Ver estado
supabase db diff
```

**Producción (Supabase Cloud):**
```bash
# Aplicar migraciones al proyecto remoto
supabase db push

# Confirmar cambios
# ⚠️ CUIDADO: Esto modifica la BD de producción
```

## 4. Flujo de Trabajo Completo

### 4.1 Desarrollo de Nueva Feature

```bash
# 1. Crear rama
git checkout -b feature/add-extreme-mode

# 2. Crear migración
supabase migration new create_extreme_tables

# 3. Editar migración SQL
# supabase/migrations/TIMESTAMP_create_extreme_tables.sql
```

```sql
-- Contenido de la migración
CREATE TABLE IF NOT EXISTS season_extreme_config (
  season_extreme_config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES season(season_id) ON DELETE CASCADE,
  extreme_deck_cards JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_season_extreme_config UNIQUE (season_id)
);

CREATE INDEX idx_extreme_config_season ON season_extreme_config(season_id);
```

```bash
# 4. Aplicar a BD local
supabase db reset

# 5. Desarrollar componente React
# src/pages/admin/SeasonExtreme.jsx

# 6. Probar localmente
npm run dev

# 7. Commit
git add .
git commit -m "feat: add extreme mode tables and UI"

# 8. Push a staging
git push origin feature/add-extreme-mode

# 9. Aplicar a staging
supabase db push --db-url $STAGING_DB_URL

# 10. Testear en staging
# ...

# 11. Merge a main
git checkout main
git merge feature/add-extreme-mode

# 12. Aplicar a producción
supabase db push
```

### 4.2 Rollback de Migración

```bash
# Ver historial de migraciones
supabase migration list

# Crear migración de rollback
supabase migration new rollback_extreme_tables
```

```sql
-- supabase/migrations/TIMESTAMP_rollback_extreme_tables.sql
DROP TABLE IF EXISTS season_extreme_participant CASCADE;
DROP TABLE IF EXISTS season_extreme_config CASCADE;
DROP VIEW IF EXISTS active_extreme_participants CASCADE;
```

```bash
# Aplicar rollback
supabase db push
```

## 5. Migrar Scripts Existentes

### 5.1 Consolidar Scripts Actuales

```bash
# Crear migración con todo el schema actual
supabase migration new consolidate_existing_schema

# Copiar contenido de todos los scripts en database/ a esta migración
# Ordenar por dependencias (foreign keys)
```

**Orden sugerido:**
```sql
-- 1. Tablas base (sin FK)
CREATE TABLE era (...);
CREATE TABLE player (...);
CREATE TABLE team (...);
CREATE TABLE card (...);

-- 2. Tablas con FK simples
CREATE TABLE season (...);
CREATE TABLE player_identity (...);

-- 3. Tablas con FK compuestas
CREATE TABLE season_zone (...);
CREATE TABLE season_zone_team (...);

-- 4. Tablas finales
CREATE TABLE season_zone_team_player (...);
CREATE TABLE scheduled_match (...);
CREATE TABLE battle (...);

-- 5. Vistas
CREATE VIEW v_player_current_tag AS ...;

-- 6. Funciones
CREATE OR REPLACE FUNCTION update_updated_at_column() ...;

-- 7. Triggers
CREATE TRIGGER update_season_updated_at ...;

-- 8. Índices
CREATE INDEX idx_player_nick ON player(nick);
...
```

### 5.2 Crear Migración por Script

**Alternativa: Una migración por cada script existente**

```bash
# Convertir cada script a migración
supabase migration new add_player_dates
# → Copiar contenido de tools/add_player_dates.sql

supabase migration new create_extreme_tables
# → Copiar contenido de database/create_extreme_tables.sql

supabase migration new make_player_b_nullable
# → Copiar contenido de database/make_player_b_nullable.sql

# ... etc
```

### 5.3 Marcar Migraciones como Aplicadas

```bash
# Si los cambios ya están en producción, marcar como aplicadas sin ejecutar
supabase db push --dry-run  # Ver qué se aplicaría

# Aplicar solo metadatos (registrar en supabase_migrations sin ejecutar)
# Requiere acceso directo a PostgreSQL:
psql $DATABASE_URL -c "
  INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
  VALUES 
    ('20260124000001', 'initial_schema', ARRAY[]::text[]),
    ('20260124000002', 'add_player_dates', ARRAY[]::text[]);
"
```

## 6. Entorno de Desarrollo Local

### 6.1 Iniciar Stack Completo

```bash
# Iniciar todos los servicios (PostgreSQL, Studio, API, Auth)
supabase start

# Output:
# API URL: http://localhost:54321
# GraphQL URL: http://localhost:54321/graphql/v1
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# Inbucket URL: http://localhost:54324
# anon key: eyJh...
# service_role key: eyJh...
```

### 6.2 Configurar Variables para Local

```bash
# .env.local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJh... # (de supabase start output)
```

### 6.3 Seed Data (Datos Iniciales)

```sql
-- supabase/seed.sql
-- Datos para desarrollo local

-- Insertar eras de ejemplo
INSERT INTO era (era_id, name, start_date, end_date) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Era 1', '2024-01-01', '2024-06-30'),
  ('22222222-2222-2222-2222-222222222222', 'Era 2', '2024-07-01', NULL);

-- Insertar jugadores de prueba
INSERT INTO player (player_id, name, nick, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Player 1', 'TestNick1', 'test1@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Player 2', 'TestNick2', 'test2@example.com');

-- Insertar equipos
INSERT INTO team (team_id, name, logo) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Team A', 'https://example.com/logo-a.png'),
  ('44444444-4444-4444-4444-444444444444', 'Team B', 'https://example.com/logo-b.png');

-- ... más datos de prueba
```

```bash
# Aplicar seed
supabase db reset  # Reset + migraciones + seed
```

### 6.4 Conectar React a BD Local

```bash
# Arrancar BD local
supabase start

# Arrancar frontend
npm run dev

# Frontend ahora apunta a http://localhost:54321 (gracias a .env.local)
```

## 7. Automatización con CI/CD

### 7.1 GitHub Actions

```yaml
# .github/workflows/db-migrations.yml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Link to Supabase project
        run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Push migrations to production
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### 7.2 Validación Pre-Push

```yaml
# .github/workflows/db-validate.yml
name: Validate Migrations

on:
  pull_request:
    paths:
      - 'supabase/migrations/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      
      - name: Start local Supabase
        run: supabase start
      
      - name: Run migrations on local DB
        run: supabase db reset
      
      - name: Check for errors
        run: |
          if supabase db diff | grep -q "ERROR"; then
            echo "Migration has errors!"
            exit 1
          fi
      
      - name: Stop Supabase
        run: supabase stop
```

## 8. Mejores Prácticas

### ✅ DO

1. **Nombres Descriptivos**
   ```bash
   supabase migration new add_ranking_field_to_players
   # ✅ 20260124120000_add_ranking_field_to_players.sql
   ```

2. **Idempotencia**
   ```sql
   -- ✅ Siempre usar IF NOT EXISTS / IF EXISTS
   CREATE TABLE IF NOT EXISTS my_table (...);
   ALTER TABLE my_table ADD COLUMN IF NOT EXISTS my_column TEXT;
   DROP TABLE IF EXISTS old_table;
   ```

3. **Transacciones**
   ```sql
   -- ✅ Wrap en transacción cuando sea posible
   BEGIN;
     ALTER TABLE users ADD COLUMN age INTEGER;
     UPDATE users SET age = 0 WHERE age IS NULL;
     ALTER TABLE users ALTER COLUMN age SET NOT NULL;
   COMMIT;
   ```

4. **Comentarios**
   ```sql
   -- ✅ Documentar propósito
   COMMENT ON TABLE season_extreme_config IS 
     'Stores extreme deck configuration (24 cards = 3 decks of 8) per season';
   ```

5. **Índices**
   ```sql
   -- ✅ Crear índices para foreign keys y búsquedas frecuentes
   CREATE INDEX idx_season_zone_team_player_player 
   ON season_zone_team_player(player_id);
   ```

### ❌ DON'T

1. **No editar migraciones aplicadas**
   ```bash
   # ❌ NUNCA hacer esto después de push
   # supabase/migrations/20260124120000_add_ranking.sql
   # (editando archivo ya aplicado)
   
   # ✅ Crear nueva migración
   supabase migration new fix_ranking_field
   ```

2. **No usar datos hardcoded en migraciones**
   ```sql
   -- ❌ Evitar esto
   INSERT INTO config VALUES ('prod-user-id', 'value');
   
   -- ✅ Usar seed.sql para datos
   ```

3. **No hacer DROP sin IF EXISTS**
   ```sql
   -- ❌ Falla si ya se ejecutó
   DROP TABLE my_table;
   
   -- ✅ Idempotente
   DROP TABLE IF EXISTS my_table CASCADE;
   ```

4. **No mezclar DDL y DML**
   ```sql
   -- ❌ Evitar
   CREATE TABLE users (...);
   INSERT INTO users VALUES (...); -- Datos en migración
   
   -- ✅ Separar
   -- Migración: solo CREATE TABLE
   -- Seed: INSERT INTO users
   ```

## 9. Comandos Útiles

```bash
# Inicializar proyecto
supabase init

# Login
supabase login

# Conectar a proyecto remoto
supabase link --project-ref <ref>

# Crear migración
supabase migration new <name>

# Listar migraciones
supabase migration list

# Pull schema remoto
supabase db pull

# Ver diferencias
supabase db diff

# Aplicar migraciones a remoto
supabase db push

# Reset BD local (drop + create + migrate + seed)
supabase db reset

# Iniciar stack local
supabase start

# Parar stack local
supabase stop

# Ver logs
supabase logs

# Backup remoto
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## 10. Migración Paso a Paso (Este Proyecto)

### Plan de Acción

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Inicializar proyecto
cd d:/LigaInterna/liga-admin
supabase init

# 3. Conectar a Supabase remoto
supabase login
supabase link --project-ref <your-project-ref>

# 4. Pull schema actual (esto genera migración base)
supabase db pull
# Crea: supabase/migrations/TIMESTAMP_remote_schema.sql

# 5. Revisar y limpiar migración generada
# Editar: supabase/migrations/TIMESTAMP_remote_schema.sql

# 6. Mover scripts de database/ a migraciones individuales
# (opcional, depende de si quieres historial granular)

# 7. Configurar seed.sql con datos de prueba
# supabase/seed.sql

# 8. Probar localmente
supabase start
npm run dev

# 9. Configurar .env.local
echo "VITE_SUPABASE_URL=http://localhost:54321" >> .env.local
echo "VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-start>" >> .env.local

# 10. Commit y push
git add supabase/
git commit -m "feat: setup Supabase migrations"
git push

# 11. Configurar GitHub Actions (opcional)
# Crear .github/workflows/db-migrations.yml

# 12. Deprecar database/ folder
# Agregar README en database/ explicando que ahora se usa supabase/migrations/
```

### Resultado Final

```
liga-admin/
├── .env.local                      # URLs locales/producción
├── .github/
│   └── workflows/
│       ├── db-migrations.yml       # Auto-deploy migraciones
│       └── db-validate.yml         # Validar PRs
├── supabase/
│   ├── config.toml                 # Configuración Supabase
│   ├── seed.sql                    # Datos de prueba
│   └── migrations/                 # ⭐ Migraciones versionadas
│       ├── 20260124000001_remote_schema.sql
│       ├── 20260124000002_add_player_dates.sql
│       ├── 20260124000003_create_extreme_tables.sql
│       └── ...
├── database/                       # ⚠️ DEPRECADO (mantener por historial)
│   └── README.md                   # "Migrado a supabase/migrations/"
├── src/
├── package.json
└── README.md
```

---

## Conclusión

Con Supabase CLI y migraciones versionadas:
- ✅ Control de versiones de BD
- ✅ Desarrollo local con Docker
- ✅ Rollback seguro
- ✅ CI/CD automatizado
- ✅ Historial auditable
- ✅ Entornos consistentes (dev/staging/prod)

**Próximo paso**: Ejecutar plan de migración (sección 10).
