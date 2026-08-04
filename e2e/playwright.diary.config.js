import { defineConfig, devices } from '@playwright/test'

// Samostatný config pro muj.bloodandguts.cz (deník, role 'diary') — záměrně ODDĚLENÝ od
// playwright.config.js/testDir 'tests', protože tahle appka nemá vlastní "test" subdoménu a
// testuje se přímo proti produkci (viz tests-diary/diary.spec.js). Kdyby spec sedět ve stejném
// testDir jako hlavní sada, `node .../cli.js test` (bez cesty, jak ho volá deploy_gated.py) by
// ho vzal s sebou a nechtěně zasáhl produkci deníku při každém nasazení hlavní trenér/klient
// appky. Spouštět výhradně ručně: `npx playwright test --config=playwright.diary.config.js`.
export default defineConfig({
  testDir: './tests-diary',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_MUJ_BASE_URL || 'https://muj.bloodandguts.cz',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
