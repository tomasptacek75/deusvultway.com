import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer } from '../helpers/auth.js'

// LanguageContext.jsx drží jazyk v localStorage klíčem 'bg_lang' a přepínač je ve vlajkové
// ikonce v hlavičce (LanguageToggle.jsx) — bez viditelného textu, jen title/aria-label.
test.describe('Přepínač jazyka EN/CS', () => {
  test('přepnutí na angličtinu změní texty v navigaci a přežije reload', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer')

    await expect(page.getByRole('link', { name: 'Klienti' })).toBeVisible()

    await page.getByLabel(/Switch to English/i).click()
    await expect(page.getByRole('link', { name: 'Clients' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('link', { name: 'Clients' })).toBeVisible()

    // vrátit zpět na češtinu, ať dál nezavádí ostatní testy v sadě (ty čekají české texty)
    await page.getByLabel(/Přepnout na češtinu/i).click()
    await expect(page.getByRole('link', { name: 'Klienti' })).toBeVisible()
  })
})
