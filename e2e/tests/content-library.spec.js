import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClientByType, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Obsahová knihovna (video ukázky, strava, playlisty) je viditelná VŠEM klientům stejně —
// osobní i portálový vidí to samé, žádné rozlišení podle client_type (rozhodnutí z návrhu
// portálového rozšíření). Skrytá položka zmizí z klientského pohledu, ale zůstává
// editovatelná/odkryvatelná na trenérské správě (hide). Trvalé DELETE (2026-08-02, na žádost
// uživatele) existuje vedle hide — na rozdíl od hide skutečně mizí i z dat.
test.describe('Knihovna obsahu — viditelnost pro všechny klienty, hide i trvalé mazání', () => {
  test('sekce a položka je vidět stejně osobnímu i portálovému klientovi, skrytí ji odstraní jen z klientského pohledu', async ({ page, request }) => {
    // Přihlašuje se postupně jako 3 různí uživatelé (trenér, dva klienti) a proklikává víc
    // stránek — proti reálnému vzdálenému serveru výchozích 45s bylo těsně nedostatečných.
    test.setTimeout(90_000)
    const trainer = await getTrainer(request)
    const headers = await authHeader(request, trainer.id)
    const personalClient = await getClientByType(request, trainer.id, 'personal')
    const portalClient = await getClientByType(request, trainer.id, 'portal')

    const sectionTitle = uniqueName('E2E Sekce')
    const itemTitle = uniqueName('E2E Položka')

    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer/content')

    await page.getByRole('button', { name: /Nová sekce|New section/ }).click()
    const sectionForm = page.locator('form').filter({ has: page.getByPlaceholder(/Název sekce|Section title/) })
    await sectionForm.getByPlaceholder(/Název sekce|Section title/).fill(sectionTitle)
    await sectionForm.getByRole('button', { name: /Uložit|Save/ }).click()

    const sectionRow = page.locator('div.rounded-lg.border', { hasText: sectionTitle })
    await expect(sectionRow).toBeVisible()
    await sectionRow.getByRole('button').first().click() // rozbalit (chevron)

    await sectionRow.getByPlaceholder(/^Název$|^Title$/).fill(itemTitle)
    await sectionRow.getByRole('button', { name: /Přidat položku|Add item/ }).click()
    await expect(sectionRow).toContainText(itemTitle)

    const sections = await (await request.get('/api/content-sections', { headers, params: { include_inactive: 1 } })).json()
    const section = sections.find((s) => s.title === sectionTitle)
    const item = section.items.find((i) => i.title === itemTitle)

    // Osobní i portálový klient vidí stejný obsah.
    for (const client of [personalClient, portalClient]) {
      await loginViaStorage(page, request, client.id)
      await page.goto('/client/library')
      await expect(page.getByText(itemTitle)).toBeVisible()
    }

    // Skrýt položku (oko na trenérské správě).
    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer/content')
    const sectionRow2 = page.locator('div.rounded-lg.border', { hasText: sectionTitle })
    await sectionRow2.getByRole('button').first().click()
    const itemCard = sectionRow2.locator('div.rounded-md', { hasText: itemTitle })
    // Tlačítka v pořadí: tužka (edit), oko (skrýt/odkrýt), koš (smazat) — od přidání trvalého
    // mazání (2026-08-02) už "poslední" tlačítko znamená koš, ne oko, proto nth(1).
    await itemCard.getByRole('button').nth(1).click() // eye toggle
    await expect(itemCard).toBeVisible() // pořád v DOM (jen ztlumená), ne smazaná

    // Zmizí z klientského pohledu.
    await loginViaStorage(page, request, personalClient.id)
    await page.goto('/client/library')
    await expect(page.getByText(itemTitle)).toHaveCount(0)

    // Skrytí samo o sobě položku z dat neodstraní.
    const afterHide = await (await request.get('/api/content-sections', { headers, params: { include_inactive: 1 } })).json()
    const stillExists = afterHide.find((s) => s.title === sectionTitle)?.items.find((i) => i.title === itemTitle)
    expect(stillExists, 'skrytá položka musí v datech dál existovat').toBeTruthy()
    expect(stillExists.active).toBe(0)

    // Úklid — smysl testu byl ověřit hide, ne nechat po sobě smetí na test.bloodandguts.cz.
    const sectionAfterHide = afterHide.find((s) => s.title === sectionTitle)
    await request.delete(`/api/content-sections/${sectionAfterHide.id}`, { headers })
  })

  test('trvalé smazání sekce (koš) odstraní sekci i její položky z dat, ne jen skryje', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const headers = await authHeader(request, trainer.id)
    const sectionTitle = uniqueName('E2E Sekce Delete')
    const itemTitle = uniqueName('E2E Položka Delete')

    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer/content')

    await page.getByRole('button', { name: /Nová sekce|New section/ }).click()
    const sectionForm = page.locator('form').filter({ has: page.getByPlaceholder(/Název sekce|Section title/) })
    await sectionForm.getByPlaceholder(/Název sekce|Section title/).fill(sectionTitle)
    await sectionForm.getByRole('button', { name: /Uložit|Save/ }).click()

    const sectionRow = page.locator('div.rounded-lg.border', { hasText: sectionTitle })
    await expect(sectionRow).toBeVisible()
    await sectionRow.getByRole('button').first().click() // rozbalit
    await sectionRow.getByPlaceholder(/^Název$|^Title$/).fill(itemTitle)
    await sectionRow.getByRole('button', { name: /Přidat položku|Add item/ }).click()
    await expect(sectionRow).toContainText(itemTitle)

    // Koš u sekce je poslední tlačítko v horním řádku karty (tužka a oko sekce nemá, jen
    // rozbalovací šipku + oko + koš).
    page.once('dialog', (d) => d.accept())
    await sectionRow.locator('div.flex.items-center.justify-between.p-4').getByRole('button').last().click()
    await expect(page.locator('div.rounded-lg.border', { hasText: sectionTitle })).toHaveCount(0)

    const sections = await (await request.get('/api/content-sections', { headers, params: { include_inactive: 1 } })).json()
    expect(sections.find((s) => s.title === sectionTitle), 'smazaná sekce nesmí v datech dál existovat').toBeUndefined()
  })
})
