# CRON - Battle Synchronization Engine

Python-based service that syncs battle data from Supercell API to Supabase.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run sync
python cron_clash_sync.py
```

## Documentation

- **Product Spec**: [../../docs/openspec/products/cron.md](../../docs/openspec/products/cron.md)
- **Battle Ingestion**: [../../docs/openspec/features/cron/battle-ingestion.md](../../docs/openspec/features/cron/battle-ingestion.md)
- **Architecture**: [../../docs/openspec/architecture/system-overview.md](../../docs/openspec/architecture/system-overview.md)

## Environment Variables

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPERCELL_TOKEN=your-supercell-token
CLAN_TAG=#PUGCG80C
```
