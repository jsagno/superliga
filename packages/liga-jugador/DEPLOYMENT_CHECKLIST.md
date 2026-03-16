# Liga Jugador – Deployment Checklist

## Pre-deployment

- [ ] All E2E tests pass locally: `npm run test:e2e:serve`
- [ ] Lint passes with zero errors: `npm run lint`
- [ ] Production build succeeds: `npm run build`
- [ ] Environment variables are configured (see below)
- [ ] Supabase RLS migration applied: `supabase/migrations/20260316000000_liga_jugador_rls.sql`

## Environment Variables

Create `.env.local` in `packages/liga-jugador/` with:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

> **Never commit `.env.local`** — it is in `.gitignore`.

For CI/production builds, inject variables via hosting platform (Netlify, Vercel, etc.).

## Build & Preview

```bash
cd packages/liga-jugador
npm install
npm run build          # outputs to packages/liga-jugador/dist/
npm run preview        # serves dist/ locally on :4173
```

## Supabase Setup

1. Apply latest migrations:
   ```bash
   cd supabase
   supabase db push       # or apply SQL manually via Supabase dashboard
   ```
2. Confirm RLS is enabled on: `app_user`, `app_user_player`, `player`,
   `scheduled_match`, `scheduled_match_battle_link`, `scheduled_match_result`,
   `battle`, `battle_round`, `battle_round_player`, `season`, `competition`, `card`.
3. Confirm all administrator accounts in `app_user` have `role = 'ADMIN'`.
4. Enable "Email (Magic Link)" in Supabase Auth → Providers.
5. Add authorized email addresses to `app_user.email` / Supabase Auth allowlist.

## Hosting (Netlify / Vercel / Static Host)

- Build command: `npm run build`  
- Publish dir: `dist`
- All routes must redirect to `index.html` (SPA routing).

  **Netlify** – add `packages/liga-jugador/public/_redirects`:
  ```
  /*  /index.html  200
  ```
  (File already present if created by scaffold.)

  **Vercel** – add `vercel.json` at repo root or in `packages/liga-jugador/`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

## Post-deployment Smoke Test

- [ ] Login page loads at `/`
- [ ] Magic link email received and opens dashboard
- [ ] Dashboard shows correct season standings
- [ ] Batallas Pendientes shows matches with countdown
- [ ] Vincular Batalla flow links a real battle
- [ ] Historial shows battle history with filter tabs
- [ ] Battle detail modal opens with correct round data
- [ ] Bottom nav works on 375px width mobile viewport
