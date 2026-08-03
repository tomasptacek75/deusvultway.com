import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClientByType, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Spravovaný katalog cenových tierů a služeb v nich (subscription_tiers/tier_services/
// tier_service_map, viz db.php gate 8) — stejný vzor jako equipment_options/gyms
// (Equipment.jsx), jen bez vlastní položky v hlavním menu (dosažitelné odkazem z Billing
// tabu a z filtru na /trainer/clients).
test.describe('Trenér — tiery a služby v nich', () => {
  test('založení tieru a služby, namapování, přiřazení klientovi přes Billing, filtrování na Klientech', async ({ page, request }) => {
    test.setTimeout(90_000)
    const trainer = await getTrainer(request)
    const headers = await authHeader(request, trainer.id)
    const client = await getClientByType(request, trainer.id, 'portal')

    const tierName = uniqueName('E2E Tier')
    const serviceName = uniqueName('E2E Služba')
    let tierId = null
    let serviceId = null

    try {
      await loginViaStorage(page, request, trainer.id)
      await page.goto('/trainer/tiers')

      await page.getByRole('button', { name: /Nový tier|New tier/ }).click()
      const tierForm = page.locator('form').filter({ has: page.getByPlaceholder(/^Název$|^Name$/) })
      await tierForm.getByPlaceholder(/^Název$|^Name$/).fill(tierName)
      await tierForm.getByRole('button', { name: /Uložit|Save/ }).click()
      const tierCard = page.locator('div.rounded-lg.border', { hasText: tierName })
      await expect(tierCard).toBeVisible()

      await page.getByRole('button', { name: /Nová služba|New service/ }).click()
      const svcForm = page.locator('form').filter({ has: page.getByPlaceholder(/^Název$|^Name$/) })
      await svcForm.getByPlaceholder(/^Název$|^Name$/).fill(serviceName)
      await svcForm.getByRole('button', { name: /Uložit|Save/ }).click()
      await expect(page.locator('div.rounded-lg.border', { hasText: serviceName })).toBeVisible()

      const tiers = await (await request.get('/api/subscription-tiers', { headers, params: { include_inactive: 1 } })).json()
      tierId = tiers.find((tr) => tr.name === tierName)?.id
      const services = await (await request.get('/api/tier-services', { headers, params: { include_inactive: 1 } })).json()
      serviceId = services.find((s) => s.name === serviceName)?.id
      expect(tierId && serviceId, 'tier i služba se měly založit').toBeTruthy()

      // Rozbalit tier a zaškrtnout mu novou službu.
      await tierCard.click()
      const checkbox = page.locator('label', { hasText: serviceName }).locator('input')
      await checkbox.click()
      await expect(checkbox).toBeChecked()

      const afterMap = await (await request.get('/api/subscription-tiers', { headers })).json()
      expect(afterMap.find((tr) => tr.id === tierId)?.service_ids).toContain(serviceId)

      // Přiřazení klientovi přes Billing tab (select naplněný z katalogu, ne volný text).
      await page.goto(`/trainer/clients/${client.id}?tab=billing`)
      const subForm = page.locator('form').filter({ has: page.getByPlaceholder(/Název plánu|Plan name/) })
      await subForm.getByPlaceholder(/Název plánu|Plan name/).fill(uniqueName('E2E Plán'))
      await subForm.getByPlaceholder('Kč').fill('777')
      await subForm.locator('select').last().selectOption({ label: tierName })
      await subForm.getByRole('button', { name: /Založit předplatné|Create subscription/ }).click()
      // Scoping mimo formulář — <option> ve stále otevřeném selectu má taky text tierName.
      await expect(page.locator('div.space-y-4').getByText(tierName)).toBeVisible()

      // Filtr Tier na /trainer/clients najde klienta.
      await page.goto('/trainer/clients?type=portal')
      await page.locator('select').nth(1).selectOption({ label: tierName })
      await expect(page.locator('tr', { hasText: client.display_name })).toBeVisible()

      // Filtr Služba (nezávislý dropdown) najde téhož klienta přes namapovanou službu.
      await page.locator('select').nth(1).selectOption('')
      await page.locator('select').nth(2).selectOption({ label: serviceName })
      await expect(page.locator('tr', { hasText: client.display_name })).toBeVisible()
    } finally {
      // subscription_tiers/tier_services nemají DELETE (hide-only) — skrýt obojí.
      if (tierId) await request.put(`/api/subscription-tiers/${tierId}`, { headers, data: { active: 0 } })
      if (serviceId) await request.put(`/api/tier-services/${serviceId}`, { headers, data: { active: 0 } })
    }
  })
})
