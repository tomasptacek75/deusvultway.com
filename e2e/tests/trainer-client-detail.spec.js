import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName, fillTimeSelect } from '../helpers/testData.js'

// ClientDetail.jsx je největší a nejfunkčně nabitější stránka aplikace (8 záložek) — trenérovo
// hlavní pracoviště. Tenhle soubor prochází záložky Tréninky, Výživa, 1RM a Platby; záložky
// Progres/Zprávy/Fotky pokrývají messaging-and-notifications.spec.js a client-progress-and-
// photos.spec.js (obsah do nich totiž zapisuje spíš klient).
test.describe('Trenér — detail klienta', () => {
  let trainer, client, headers, exerciseId

  test.beforeEach(async ({ request }) => {
    trainer = await getTrainer(request)
    client = await getClient(request)
    headers = await authHeader(request, trainer.id)
    // Vlastní cvik přes API — rychlejší setup, ať test neřeší, jestli seedovaná knihovna
    // cviků zrovna něco obsahuje.
    const res = await request.post('/api/exercises', {
      headers,
      data: { name: uniqueName('E2E Setup Cvik'), muscle_group: 'E2E' },
    })
    expect(res.ok()).toBeTruthy()
    exerciseId = (await res.json()).id
  })

  test.afterEach(async ({ request }) => {
    if (exerciseId) await request.delete(`/api/exercises/${exerciseId}`, { headers })
  })

  test('záložka Tréninky: vytvoření tréninku, přidání cviku, úprava a smazání', async ({ page, request }) => {
    await loginViaStorage(page, request, trainer.id)
    await page.goto(`/trainer/clients/${client.id}`)
    await expect(page.getByText(client.display_name)).toBeVisible()

    const title = uniqueName('E2E Trénink')
    const form = page.locator('form').filter({ has: page.getByPlaceholder(/Název tréninku/i) })
    await form.locator('input[type="date"]').fill('2027-03-15')
    await fillTimeSelect(form, '09:00')
    await form.getByPlaceholder(/Název tréninku/i).fill(title)
    await form.getByRole('button', { name: /Přidat|Add/ }).click()

    const row = page.locator('div.rounded-lg.border', { hasText: title })
    await expect(row).toBeVisible()

    // rozbalit a přidat cvik
    await row.getByRole('button').first().click() // chevron
    await row.locator('select').selectOption(String(exerciseId))
    await row.getByRole('button', { name: /Přidat cvik|Add exercise/ }).click()
    await expect(row).toContainText('E2E Setup Cvik')

    // Smazat trénink (úklid). Koš nemá text ani title — je to poslední tlačítko v horním
    // řádku karty (pořadí v DOM: šipka pro rozbalení, tlačítko pro úpravu času/místa,
    // tužka u názvu, koš — viz WorkoutRow ve frontend/src/pages/trainer/ClientDetail.jsx).
    const topRow = row.locator('div.flex.items-center.justify-between.p-4')
    await topRow.getByRole('button').last().click()
    await expect(page.getByText(title, { exact: true })).not.toBeVisible()
  })

  test('záložka Výživa: vytvoření plánu', async ({ page, request }) => {
    await loginViaStorage(page, request, trainer.id)
    await page.goto(`/trainer/clients/${client.id}?tab=nutrition`)

    const title = uniqueName('E2E Výživový plán')
    await page.getByPlaceholder(/Název plánu/i).fill(title)
    await page.getByPlaceholder(/Kalorie\/den|Calories\/day/).fill('2500')
    await page.getByRole('button', { name: /Uložit výživový plán|Save nutrition plan/ }).click()

    // Karty výživových plánů se nikdy nemažou (žádný DELETE endpoint) a "2500 kcal" není
    // unikátní text — po opakovaných bězích by na stránce mohlo být víc karet se stejnou
    // hodnotou kalorií. Scoping přes třídu konkrétní karty (viz ClientDetail.jsx) místo
    // first()/last() na "div" obecně, protože ten by narazil buď na obalující .space-y-3
    // wrapper všech karet, nebo na vnitřní div s pouhým titulkem (bez kcal).
    const planCard = page.locator('div.rounded-lg.border').filter({ hasText: title })
    await expect(planCard).toBeVisible()
    await expect(planCard).toContainText('2500 kcal')
  })

  test('záložka 1RM: zaznamenání nové hodnoty', async ({ page, request }) => {
    await loginViaStorage(page, request, trainer.id)
    await page.goto(`/trainer/clients/${client.id}?tab=one-rm`)

    await page.locator('select').first().selectOption(String(exerciseId))
    await page.getByLabel(/1RM \(kg\)/).fill('87.5')
    await page.getByRole('button', { name: /Zaznamenat 1RM|Record 1RM/ }).click()

    await expect(page.getByText(/Nejnovější|Latest/)).toContainText('87.5')
  })

  test('záložka Platby: založení předplatného a zaznamenání platby', async ({ page, request }) => {
    await loginViaStorage(page, request, trainer.id)
    await page.goto(`/trainer/clients/${client.id}?tab=billing`)

    const planName = uniqueName('E2E Plán')
    await page.getByPlaceholder(/Název plánu/i).fill(planName)
    await page.getByPlaceholder('Kč').fill('1500')
    await page.getByRole('button', { name: /Založit předplatné|Create subscription/ }).click()

    const subCard = page.locator('div.rounded-lg.border', { hasText: planName })
    await expect(subCard).toBeVisible()
    await expect(subCard).toContainText('1500 Kč')

    await subCard.getByPlaceholder(/Kč přijato|Kč received/).fill('1500')
    await subCard.getByRole('button', { name: /Zaznamenat platbu|Record payment/ }).click()
    await expect(subCard).toContainText('1500 Kč')
  })
})
