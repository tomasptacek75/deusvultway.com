import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Spravovaný katalog vybavení (equipment_options) — výběr ze seznamu, ne volný text. Hide-not-
// delete přes `active`, žádný DELETE endpoint neexistuje záměrně vůbec.
test.describe('Trenér — katalog vybavení, přiřazení klientovi doma', () => {
  test('vytvoření, úprava, skrytí (ne smazání) a přiřazení klientovi jako domácí vybavení', async ({ page, request }) => {
    // Hodně sekvenčních kroků proti reálnému vzdálenému serveru — výchozích 45s bylo těsně
    // nedostatečných.
    test.setTimeout(90_000)
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const headers = await authHeader(request, trainer.id)
    const name = uniqueName('E2E Vybavení')

    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer/equipment')

    // Formulář nové položky katalogu je ten druhý na stránce (první je "Nová posilovna").
    await page.getByRole('button', { name: /Nová položka|New item/ }).click()
    const form = page.locator('form').filter({ has: page.getByPlaceholder(/^Název$|^Name$/) })
    await form.getByPlaceholder(/^Název$|^Name$/).fill(name)
    await form.getByRole('button', { name: /Uložit|Save/ }).click()

    const card = page.locator('div.rounded-lg.border', { hasText: name })
    await expect(card).toBeVisible()

    // Úprava (tužka) — po kliknutí se jméno přesune z textu do hodnoty <input>, takže card
    // (hasText: name) by po překreslení přestal matchovat (input value se nepočítá jako
    // textContent). V editaci je vždy jen jedna položka, takže první <input> na celé stránce
    // je jednoznačně to správné pole (ostatní karty žádný input nemají).
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
      // Přiřazení klientovi jako domácí vybavení na záložce Vybavení v ClientDetail — jen když
      // klient netrénuje v konkrétní posilovně (gym_id je null, výchozí "Doma"). Nejdřív odkrýt
      // zpátky, ať se dá zaškrtnout (klient vidí jen aktivní volby).
      await request.put(`/api/equipment-options/${created.id}`, { headers, data: { active: 1 } })
      await request.put(`/api/clients/${client.id}`, { headers, data: { gym_id: null } })
      await page.goto(`/trainer/clients/${client.id}?tab=equipment`)
      await expect(page.getByText(/Vybavení doma|Home equipment/i)).toBeVisible()
      // Checkbox je potomek <label>, ne sourozenec — .locator('input') hledá uvnitř labelu.
      // Je to plně řízený checkbox bez optimistického update — mezi kliknutím a dokončením
      // POST+reload na chvíli "zabliká" zpět, takže .click() + expect(...).toBeChecked()
      // (s pollingem) místo přísného .check()/.uncheck().
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

// Každá posilovna má VLASTNÍ seznam vybavení (gym_equipment) — dvě posilovny s odlišným
// vybavením, ne jeden sdílený zaškrtávací seznam pro všechny (rozhodnutí z 2026-07-28: "Ve
// Vybavení by měl být seznam posiloven a u každé možno zadat jejich vybavení").
test.describe('Trenér — posilovna s vlastním seznamem vybavení', () => {
  test('vybavení přiřazené jedné posilovně se neobjeví u druhé, klient ho uvidí podle toho, kam patří', async ({ page, request }) => {
    test.setTimeout(90_000)
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const headers = await authHeader(request, trainer.id)

    const gymAName = uniqueName('E2E Posilovna A')
    const gymBName = uniqueName('E2E Posilovna B')
    const itemName = uniqueName('E2E Stroj')

    // Vlastní testovací kus vybavení, ať test nezávisí na tom, co je zrovna v katalogu.
    const itemRes = await request.post('/api/equipment-options', { headers, data: { name: itemName } })
    const item = await itemRes.json()

    let gymAId = null
    let gymBId = null
    try {
      await loginViaStorage(page, request, trainer.id)
      await page.goto('/trainer/equipment')

      // Založit dvě posilovny přes formulář "Nová posilovna" (první form na stránce).
      for (const gymName of [gymAName, gymBName]) {
        await page.getByRole('button', { name: /Nová posilovna|New gym/ }).click()
        const gymForm = page.locator('form').filter({ has: page.getByPlaceholder(/Název posilovny|Gym name/) })
        await gymForm.getByPlaceholder(/Název posilovny|Gym name/).fill(gymName)
        await gymForm.getByRole('button', { name: /Uložit|Save/ }).click()
        await expect(page.getByText(gymName)).toBeVisible()
      }

      const gyms = await (await request.get('/api/gyms', { headers, params: { include_inactive: 1 } })).json()
      gymAId = gyms.find((g) => g.name === gymAName)?.id
      gymBId = gyms.find((g) => g.name === gymBName)?.id
      expect(gymAId && gymBId, 'obě posilovny se měly založit').toBeTruthy()

      // Rozbalit posilovnu A a zaškrtnout jí testovací vybavení.
      await page.getByText(gymAName).click()
      const checkboxInA = page.locator('label', { hasText: itemName }).locator('input')
      await checkboxInA.click()
      await expect(checkboxInA).toBeChecked()

      // Posilovna A má vybavení, posilovna B ne.
      const equipmentA = await (await request.get(`/api/gyms/${gymAId}/equipment`, { headers })).json()
      const equipmentB = await (await request.get(`/api/gyms/${gymBId}/equipment`, { headers })).json()
      expect(equipmentA.some((e) => e.name === itemName)).toBeTruthy()
      expect(equipmentB.some((e) => e.name === itemName)).toBeFalsy()

      // Klient nastavený na posilovnu A vidí v ClientDetail přesně tohle vybavení, jen ke čtení
      // (žádné zaškrtávání — vybavení patří posilovně, ne klientovi).
      await request.put(`/api/clients/${client.id}`, { headers, data: { gym_id: gymAId } })
      await page.goto(`/trainer/clients/${client.id}?tab=equipment`)
      await expect(page.getByText(/Vybavení v této posilovně|Equipment at this gym/i)).toBeVisible()
      await expect(page.getByText(itemName)).toBeVisible()

      // Přepnutí klienta zpět na "Doma" vrátí zaškrtávací seznam domácího vybavení.
      await page.locator('select').last().selectOption('')
      await expect(page.getByText(/Vybavení doma|Home equipment/i)).toBeVisible()
      const afterHome = await (await request.get(`/api/clients/${client.id}`, { headers })).json()
      expect(afterHome.gym_id).toBeNull()
    } finally {
      await request.put(`/api/clients/${client.id}`, { headers, data: { gym_id: null } })
      await request.put(`/api/equipment-options/${item.id}`, { headers, data: { active: 0 } })
      // gyms nemá DELETE (hide-only) — skrýt obě testovací posilovny.
      if (gymAId) await request.put(`/api/gyms/${gymAId}`, { headers, data: { active: 0 } })
      if (gymBId) await request.put(`/api/gyms/${gymBId}`, { headers, data: { active: 0 } })
    }
  })
})
