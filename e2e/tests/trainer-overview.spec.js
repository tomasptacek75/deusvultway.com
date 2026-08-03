import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Overview.jsx (index /trainer, landing page trenéra od 2026-08-03) ukazuje počty
// "potřebuje pozornost" za Portál/Osobní a proklikem na číslo přenese na /trainer/clients
// s předvyplněným řazením (viz TrainerDashboard.jsx's ?sort=&dir= a utils/clientHealth.js).
test.describe('Trenér — Overview dashboard', () => {
  test('nový portálový klient bez naplánovaného tréninku se objeví v "bez příští konzultace" a proklik na něj přistane na filtrovaném seznamu', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const headers = await authHeader(request, trainer.id)
    const name = uniqueName('E2E Overview Klient')
    let clientId = null

    try {
      const created = await (await request.post('/api/clients', {
        headers,
        data: { email: `e2e-overview-${Date.now()}@example.com`, display_name: name, client_type: 'portal' },
      })).json()
      clientId = created.id

      await loginViaStorage(page, request, trainer.id)
      await page.goto('/trainer')
      await expect(page.getByRole('heading', { name: /Přehled|Overview/ })).toBeVisible()

      // Portál sekce, dlaždice "bez příští konzultace" — proklik.
      const portalSection = page.locator('section', { has: page.getByRole('heading', { name: /^Portál/ }) })
      await portalSection.getByText(/bez příští konzultace|no upcoming consultation/i).click()

      await page.waitForURL(/\/trainer\/clients\?type=portal&sort=next_consultation_date&dir=asc/)
      const row = page.locator('tr', { hasText: name })
      await expect(row).toBeVisible()
    } finally {
      if (clientId) await request.delete(`/api/clients/${clientId}`, { headers })
    }
  })
})
