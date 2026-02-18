# Documentation

Central documentation hub for the LigaInterna platform.

## 📂 Structure

### [openspec/](./openspec/)
Complete product specifications using the OpenSpec framework:

- **[products/](./openspec/products/)** - High-level product definitions
  - [CRON - Battle Sync Engine](./openspec/products/cron.md)
  - [LIGA-ADMIN - Tournament Dashboard](./openspec/products/liga-admin.md)

- **[features/](./openspec/features/)** - Detailed feature specifications
  - [CRON Features](./openspec/features/cron/)
  - [LIGA-ADMIN Features](./openspec/features/liga-admin/)

- **[business-rules/](./openspec/business-rules/)** - Business logic & validation
  - [Tournament Rules](./openspec/business-rules/tournament-rules.md)
  - [Deck Validation](./openspec/business-rules/deck-validation.md)
  - [Scoring System](./openspec/business-rules/scoring-system.md)
  - [Player Eligibility](./openspec/business-rules/player-eligibility.md)

- **[architecture/](./openspec/architecture/)** - System design
  - [System Overview](./openspec/architecture/system-overview.md)
  - [Data Model](./openspec/architecture/data-model.md)
  - [API Integration](./openspec/architecture/api-integration.md)

### [REGALAMENTO.md](./REGALAMENTO.md)
Portuguese tournament regulations - official league rules and structure.

## 🎯 For Different Audiences

### For Developers
Start with:
1. [Architecture Overview](./openspec/architecture/system-overview.md)
2. [Data Model](./openspec/architecture/data-model.md)
3. Product-specific docs in [../../packages/](../packages/)

### For Product Managers
Start with:
1. [Product Specifications](./openspec/products/)
2. [Business Rules](./openspec/business-rules/)
3. [Feature Specifications](./openspec/features/)

### For Tournament Organizers
Start with:
1. [REGALAMENTO.md](./REGALAMENTO.md) - Official rules
2. [Tournament Rules](./openspec/business-rules/tournament-rules.md)
3. [Scoring System](./openspec/business-rules/scoring-system.md)

## 📝 Contributing to Documentation

### Adding a New Product
1. Create `openspec/products/[product-name].md`
2. Follow the template in [openspec/products/README.md](./openspec/products/README.md)
3. Update [openspec/changelog.md](./openspec/changelog.md)

### Documenting a Feature
1. Create `openspec/features/[product]/[feature-name].md`
2. Follow the template in [openspec/features/README.md](./openspec/features/README.md)
3. Link from product specification
4. Update changelog

### Updating Business Rules
1. Edit relevant file in `openspec/business-rules/`
2. Include examples and edge cases
3. Update affected feature docs
4. Update changelog

## 🔗 External Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supercell API](https://developer.clashroyale.com)
- [React Documentation](https://react.dev)
- [Python Documentation](https://docs.python.org)

## 📊 Documentation Status

| Section | Status | Last Updated |
|---------|--------|--------------|
| Products | ✅ Complete | 2025-02-17 |
| Features | ✅ Complete | 2025-02-17 |
| Business Rules | ✅ Complete | 2025-02-17 |
| Architecture | ✅ Complete | 2025-02-17 |
| REGALAMENTO | ✅ Current | - |

## ❓ Questions?

For questions about:
- **Technical implementation**: See [packages/](../packages/) READMEs
- **Product decisions**: See [openspec/products/](./openspec/products/)
- **Business rules**: See [openspec/business-rules/](./openspec/business-rules/)
- **Architecture**: See [openspec/architecture/](./openspec/architecture/)
