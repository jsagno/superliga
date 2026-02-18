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
