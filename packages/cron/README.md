# CRON - Battle Synchronization Engine

Python-based service that syncs battle data from Supercell API to Supabase.

The production loop now orchestrates the full backend cycle:

1. Run clash sync
2. Run standings refresh
3. Sleep 30 minutes

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

## Runtime Behavior

`cron_clash_sync.py` is the primary scheduler. Each loop iteration:

1. Executes the normal battle sync flow.
2. If sync completes, triggers `packages/standings-cron/standings_cron.py` as a one-shot phase in the same process.
3. Waits 30 minutes before the next cycle.

If the standings phase fails, the loop stays alive and retries in the next cycle. If the sync phase aborts, standings is skipped for that cycle.

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

The chained standings phase reuses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from this process and bridges them to the settings expected by `standings-cron`.
