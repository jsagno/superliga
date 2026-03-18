# Shared Database Resources

Database schema, migrations, and utilities for LigaInterna.

## 📁 Structure

```
shared/database/
├── schema.sql              # Complete current schema (copied from supabase/seed.sql)
├── migrations/             # Future: Version-controlled migrations
├── seeds/                  # Future: Test/dev data
└── README.md (this file)
```

## 🗄️ Current Database Location

The main database configuration and migrations are in: **[../../supabase/](../../supabase/)**

This directory (`shared/database/`) is for:
- Reference copies of the schema
- Shared utilities and scripts
- Documentation on data model decisions

## 📚 Documentation

For complete database documentation, see:
- [Data Model Specification](../../docs/openspec/architecture/data-model.md)
- [System Architecture](../../docs/openspec/architecture/system-overview.md)

## 🔧 Database Setup

```bash
# Using Supabase CLI
cd ../../supabase
supabase db push

# Or manually
psql -h your-host -U postgres -d your-db -f ../../supabase/seed.sql
```

## 📊 Schema Overview

Main entities:
- `era` → `season` → `zone` → `team` → `player`
- `battle` → `round` → `round_player`
- `card`, `player_identity`, `daily_points`, etc.

See [schema.sql](./schema.sql) for complete schema.

## 🚀 Future Enhancements

- Migration versioning system
- Seed data for testing
- Database utility scripts
- Schema documentation generator

---

## 🔐 Row Level Security (RLS)

Applied via migration `supabase/migrations/20260316000000_liga_jugador_rls.sql`.

### Strategy

Two roles exist in `app_user.role`:
| Role | Access |
|------|--------|
| `ADMIN` | Full read/write on all tables (used by `liga-admin` app) |
| `PLAYER` | Restricted to own data only (used by `liga-jugador` portal) |

`service_role` (cron, migrations) bypasses RLS by default.

### Helper Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `public.current_user_role()` | `text` | Returns 'ADMIN' or 'PLAYER' for the current auth user |
| `public.current_player_id()` | `uuid` | Returns player_id linked to the current auth user |
| `public.player_participates_in_match(uuid)` | `boolean` | True if current player is player_a or player_b |

All functions are `SECURITY DEFINER` and `STABLE`.

### Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `app_user` | Own row only | Admin | Admin | Admin |
| `app_user_player` | Own link only | Admin | Admin | Admin |
| `player` | Own + rivals | Admin | Admin | Admin |
| `scheduled_match` | Own matches | Admin | Own matches | Admin |
| `scheduled_match_battle_link` | Own matches | Own matches | Admin | Admin |
| `scheduled_match_result` | Own matches | Admin | Admin | Admin |
| `battle` | Linked to own matches | - | - | - |
| `battle_round` | Linked to own matches | - | - | - |
| `battle_round_player` | Linked to own matches | - | - | - |
| `season` | All authenticated | Admin | Admin | Admin |
| `competition` | All authenticated | Admin | Admin | Admin |
| `card` | All authenticated | Admin | Admin | Admin |

### Important: liga-admin compatibility

`liga-admin` uses the anon key with Supabase auth. Admin users have `app_user.role = 'ADMIN'`,
which grants full access. Ensure all administrator accounts have `role = 'ADMIN'`.
