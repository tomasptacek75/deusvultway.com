import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './helpers/baseUrl.js'

// Proti test.bloodandguts.cz běžíme jako gate před produkčním deployem (viz
// deploy_gated.py v rootu repa a CLAUDE.md). Lze přepsat na lokální dev server
// přes E2E_BASE_URL, např. při ladění testu ještě před nasazením na test subdoménu:
//   E2E_BASE_URL=http://localhost:5310 npx playwright test

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // Testy sdílí jednu živou (byť testovací) SQLite DB přes REST API — paralelní běh by
  // riskoval, že si dvě sady sáhnou na stejného "prvního klienta" nebo tým zároveň.
  // Sériový běh v jednom workeru je pomalejší, ale deterministický.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
