import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Spravovaný seznam vybavení/posiloven (equipment_options) — výběr ze seznamu, ne volný text
// (rozhodnutí z návrhu portálového rozšíření). Hide-not-delete přes `active`, žádný DELETE
// endpoint existuje záměrně vůbec.
test.describe('Trenér — katalog vybavení a přiřazení klientovi', () => {
  test('vytvoření, úprava, skrytí (ne smazání) a přiřazení klientovi', async ({ page, request }) => {
    // Hodně sekvenčních kroků (vytvoření, úprava, skrytí, ověření ze dvou úhlů, přiřazení
    // klientovi) proti reálnému vzdálenému serveru — výchozích 45s bylo těsně nedostatečných.
    test.setTimeout(90_000)
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const headers = await authHeader(request, trainer.id)
    const name = uniqueName('E2E Vybavení')

    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer/equipment')

    await page.getByRole('button', { name: /Nová položka|New item/ }).click()
    const form = page.locator('form').filter({ has: page.getByPlaceholder(/^Název$|^Name$/) })
    await form.getByPlaceholder(/^Název$|^Name$/).fill(name)
    await form.locator('select').selectOption('equipment')
    await form.getByRole('button', { name: /Uložit|Save/ }).click()

    const card = page.locator('div.rounded-lg.border', { hasText: name })
    await expect(card).toBeVisible()

    // Úprava (tužka) — po kliknutí se jméno přesune z textu do hodnoty <input>, takže card
    // (hasText: name) by po překreslení přestal matchovat (input value se nepočítá jako
    // textContent). V editaci je vždy jen jedna položka (editingId), takže první <input> na
    // celé stránce je jednoznačně to správné pole (ostatní karty žádný input nemají).
    await card.getByRole('button').first().click()
    const renamed = `${name} (upraveno)`
    await page.locator('input').first().fill(renamed)
    await page.getByRole('button', { name: /^Uložit$|^Save$/ }).click()
    await expect(page.locator('div.rounded-lg.border', { hasText: renamed })).toBeVisible()

    // Skrýt (oko) — položka zůstává na trenérské správě viditelná (jen ztlumená), ale zmizí
    // z klientsky dostupného seznamu (GET /equipment-options bez include_inactive).
    const hiddenCard = page.locator('div.rounded-lg.border', { hasText: renamed })
    await hiddenCard.getByRole('button').last().click()
    await expect(hiddenCard).toBeVisible() // pořád v DOM, jen skrytá vizuálně (opacity)

    const clientHeaders = await authHeader(request, client.id)
    const visibleToClient = await (await request.get('/api/equipment-options', { headers: clientHeaders })).json()
    expect(visibleToClient.some((o) => o.name === renamed)).toBeFalsy()

    const allForTrainer = await (await request.get('/api/equipment-options', { headers, params: { include_inactive: 1 } })).json()
    const created = allForTrainer.find((o) => o.name === renamed)
    expect(created, 'skrytá položka musí v datech dál existovat (hide-not-delete)').toBeTruthy()
    expect(created.active).toBe(0)

    try {
      // Přiřazení klientovi na záložce Vybavení v ClientDetail — nejdřív odkrýt zpátky,
      // ať se dá zaškrtnout (klient vidí jen aktivní volby).
      await request.put(`/api/equipment-options/${created.id}`, { headers, data: { active: 1 } })
      await page.goto(`/trainer/clients/${client.id}?tab=equipment`)
      // Checkbox je potomek <label>, ne sourozenec (EquipmentTab v ClientDetail.jsx renderuje
      // <label><input/>{text}</label>) — .locator('input') hledá uvnitř matchnutého labelu.
      // Je to plně řízený (controlled) checkbox bez optimistického update — mezi kliknutím a
      // dokončením POST+reload na chvíli "zabliká" zpět na starou hodnotu, takže přísné
      // .check()/.uncheck() (vyžadují stabilní změnu hned) hlásí "did not change its state".
      // .click() + expect(...).toBeChecked() s pollingem tohle toleruje.
      const checkbox = page.locator('label', { hasText: renamed }).locator('input')
      await checkbox.click()
      await expect(checkbox).toBeChecked()
      const assigned = await (await request.get(`/api/clients/${client.id}/equipment`, { headers })).json()
      expect(assigned.some((e) => e.name === renamed)).toBeTruthy()

      await checkbox.click()
      await expect(checkbox).not.toBeChecked()
      const afterUncheck = await (await request.get(`/api/clients/${client.id}/equipment`, { headers })).json()
      expect(afterUncheck.some((e) => e.name === renamed)).toBeFalsy()
    } finally {
      // equipment_options nemá DELETE (hide-only) — skrýt zpět, ať se v seznamu nehromadí aktivní testovací položky.
      await request.put(`/api/equipment-options/${created.id}`, { headers, data: { active: 0 } })
    }
  })
})
