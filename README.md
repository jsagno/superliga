# LigaInterna - Clash Royale Competitive League Platform

A comprehensive tournament management platform for organizing competitive Clash Royale leagues.

## 🏗️ Repository Structure

```
LigaInterna/
├── .github/
│   └── agents/                    # AI Agent prompts
│       ├── Developer.agent.md
│       └── ProductManager.agent.md
│
├── docs/                          # All documentation
│   ├── openspec/                  # Product specifications
│   │   ├── products/
│   │   ├── features/
│   │   ├── business-rules/
│   │   └── architecture/
│   ├── REGALAMENTO.md            # Portuguese tournament rules
│   └── README.md
│
├── packages/                      # All code products
│   ├── cron/                     # Battle sync service
│   │   ├── src/
│   │   ├── .env.example
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   └── liga-admin/               # Admin dashboard
│       ├── src/
│       ├── public/
│       ├── package.json
│       ├── vite.config.js
│       └── README.md
│
├── shared/                        # Shared resources
│   └── database/                 # Database schemas, migrations
│       ├── migrations/
│       ├── seeds/
│       └── README.md
│
├── scripts/                       # Utility scripts
│   └── migrate-to-monorepo.ps1
│
├── supabase/                      # Supabase configuration
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
│
├── .gitignore
└── README.md (this file)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.10+
- Supabase account

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd LigaInterna
   ```

2. **Install dependencies**
   ```bash
   # Install liga-admin dependencies
   cd packages/liga-admin
   npm install
   
   # Install cron dependencies
   cd ../cron
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   # Copy environment templates
   cp packages/liga-admin/.env.example packages/liga-admin/.env
   cp packages/cron/.env.example packages/cron/.env
   
   # Edit with your Supabase credentials
   ```

4. **Run development servers**
   ```bash
   # Terminal 1: Liga Admin
   cd packages/liga-admin
   npm run dev
   
   # Terminal 2: Cron (manual trigger for testing)
   cd packages/cron
   python cron_clash_sync.py
   ```

## 📦 Products

### CRON - Battle Synchronization Engine
Python-based service that syncs battle data from Supercell API to Supabase.

**Documentation**: [packages/cron/README.md](./packages/cron/README.md)  
**Specification**: [docs/openspec/products/cron.md](./docs/openspec/products/cron.md)

**Key Features**:
- Real-time battle ingestion
- Data validation & repair
- Player identity management
- Card catalog maintenance

### LIGA-ADMIN - Tournament Management Dashboard
React 19 admin interface for managing competitive seasons.

**Documentation**: [packages/liga-admin/README.md](./packages/liga-admin/README.md)  
**Specification**: [docs/openspec/products/liga-admin.md](./docs/openspec/products/liga-admin.md)

**Key Features**:
- Tournament structure management
- Player & team management
- Real-time standings
- Deck validation (Extreme/Risky modes)
- **Card Restrictions** - Restrict specific cards for players per season

## 🎯 Core Features

### Card Restrictions (RES)
Competitive balance tool for restricting specific cards per player during tournament seasons.

**Documentation**: [docs/openspec/features/RES_FEATURE.md](./docs/openspec/features/RES_FEATURE.md)

**Capabilities**:
- Bulk create restrictions for multiple players and cards simultaneously
- Real-time updates across admin sessions
- Duplicate detection and prevention
- Search and filter by player/card
- Undo-enabled deletion with 5-second window
- Full audit trail with creator tracking

**Access**: Admin Dashboard → Seasons → "Restricciones" button

### Extreme Mode (Validation)
Advanced deck validation with professional tournament rules.

**Documentation**: [docs/openspec/features/EXTREME_FEATURE.md](./docs/openspec/features/EXTREME_FEATURE.md)

**Capabilities**:
- Card rarity pair detection
- Level balance verification
- Elixir cost constraints
- Evolution variant support

### Clash Sync (CRON)
Automated battle data synchronization.

**Documentation**: [docs/openspec/features/cron/](./docs/openspec/features/cron/)

## 📚 Documentation

### Product Specifications
Complete product specs in [docs/openspec/](./docs/openspec/):
- **Products**: High-level product definitions
- **Features**: Detailed feature specifications
- **Business Rules**: Tournament rules, scoring, validation
- **Architecture**: System design and data model

### AI Agents
Agent prompts for development assistance in [.github/agents/](./.github/agents/):
- **Developer Agent**: Technical expert for implementation
- **Product Manager Agent**: Strategic product planning

### Business Rules
Portuguese tournament rules: [docs/REGALAMENTO.md](./docs/REGALAMENTO.md)

## 🗄️ Database

### Schema
Complete PostgreSQL schema in [supabase/seed.sql](./supabase/seed.sql)

### Migrations
Database migrations in [supabase/migrations/](./supabase/migrations/)

### Setup
```bash
# Using Supabase CLI
supabase db push

# Or apply manually
psql -h <host> -U <user> -d <database> -f supabase/seed.sql
```

## 🛠️ Development

### Project Commands

```bash
# Liga Admin
cd packages/liga-admin
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint

# Cron
cd packages/cron
python cron_clash_sync.py   # Run sync manually
```

### Migrating to Monorepo

If you're migrating from separate repositories, see [scripts/migrate-to-monorepo.ps1](./scripts/migrate-to-monorepo.ps1)

## 📊 Architecture

```
┌─────────────────────────────────────────────────┐
│           LigaInterna Platform                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐         ┌─────────────────┐  │
│  │  CRON/SYNC   │         │   LIGA-ADMIN    │  │
│  │  (Python)    │         │   (React 19)    │  │
│  └──────────────┘         └─────────────────┘  │
│         │                         │             │
│         └────────┬────────────────┘             │
│                  │                              │
│          ┌───────▼────────┐                     │
│          │    Supabase    │                     │
│          │   PostgreSQL   │                     │
│          └────────────────┘                     │
│                  │                              │
│          ┌───────▼────────┐                     │
│          │ Supercell API  │                     │
│          └────────────────┘                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

See [docs/openspec/architecture/](./docs/openspec/architecture/) for detailed architecture documentation.

## 🔒 Git Hooks

The project includes automated git hooks to enforce code quality:

### Pre-Commit Hook
- **Purpose**: Prevents accidental commit of credentials and secrets
- **Checks**: Scans for API tokens, passwords, private keys
- **Status**: ✅ Already installed

### Pre-Push Hook
- **Purpose**: Enforces Playwright E2E tests for UI changes
- **Checks**: Ensures UI components/pages have corresponding tests
- **Installation**: Run `bash scripts/install-git-hooks.sh`

### Installation

```bash
# From repository root
bash scripts/install-git-hooks.sh
```

### Bypassing Hooks (Not Recommended)

```bash
# Skip pre-commit (credential check)
SKIP_PRE_COMMIT_HOOK=1 git commit -m "..."

# Skip pre-push (UI test enforcement)
SKIP_PRE_PUSH_HOOK=1 git push
```

**Important**: Only bypass hooks when you understand the implications. The hooks exist to protect code quality and security.

## 🧪 Testing

```bash
# Liga Admin - Unit Tests
cd packages/liga-admin
npm run test:unit

# Liga Admin - E2E Tests
cd packages/liga-admin
npm run test:e2e

# Liga Admin - Check UI Test Coverage
npm run check:ui-e2e

# Cron
cd packages/cron
pytest tests/
```

## 📝 Contributing

1. Check [docs/openspec/](./docs/openspec/) for specifications
2. Follow existing code structure
3. Update documentation for new features
4. Write tests for new functionality
5. Update changelog

## 🔐 Environment Variables

### Required for LIGA-ADMIN
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Required for CRON
```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPERCELL_TOKEN=your-supercell-token
CLAN_TAG=#PUGCG80C
```

## 📄 License

[Your License Here]

## 🔗 Links

- **Supabase**: [https://supabase.com](https://supabase.com)
- **Supercell API**: [https://developer.clashroyale.com](https://developer.clashroyale.com)
- **Documentation**: [docs/openspec/README.md](./docs/openspec/README.md)
