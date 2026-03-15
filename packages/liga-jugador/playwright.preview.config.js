import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
  },
  reporter: [['list']],
  webServer: {
    command: 'npm run preview -- --port 4174',
    url: 'http://localhost:4174',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      VITE_E2E_AUTH_BYPASS: 'true',
      VITE_E2E_APP_USER_ID: 'e2e-app-user',
      VITE_E2E_PLAYER_ID: 'e2e-player',
      VITE_SUPABASE_URL: 'https://kivlwozjpijejrubapcw.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-placeholder',
    },
  },
})
