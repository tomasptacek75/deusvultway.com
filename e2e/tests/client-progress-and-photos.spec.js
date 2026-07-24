import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PHOTO = path.join(__dirname, '..', 'fixtures', 'photo.png')

test.describe('Klient — progres, výživa, platby a fotky', () => {
  test('klient přidá cíl a záznam váhy', async ({ page, request }) => {
    const client = await getClient(request)
    await loginViaStorage(page, request, client.id)
    await page.goto('/client/progress')

    const goalText = uniqueName('E2E Cíl klienta')
    await page.getByPlaceholder(/Popiš svůj cíl/i).fill(goalText)
    await page.getByRole('button', { name: /Přidat cíl|Add goal/ }).click()
    await expect(page.getByText(goalText)).toBeVisible()

    await page.getByPlaceholder(/Váha \(kg\)/i).fill('79.4')
    await page.getByRole('button', { name: /Uložit záznam|Save entry/ }).click()
    await expect(page.getByText('79.4 kg')).toBeVisible()
  })

  test('klient nahraje a smaže fotku pokroku', async ({ page, request }) => {
    const client = await getClient(request)
    await loginViaStorage(page, request, client.id)
    await page.goto('/client/progress')

    const before = await page.locator('.aspect-square').count()
    // Vstup pro výběr souboru je uvnitř <label>Nahrát fotku…<input type="file" hidden/></label>
    // (viz Progress.jsx) — getByText najde label, input je jeho potomek.
    await page.getByText(/Nahrát fotku|Upload photo/).locator('input[type="file"]').setInputFiles(FIXTURE_PHOTO)
    await expect(page.locator('.aspect-square')).toHaveCount(before + 1, { timeout: 15_000 })

    const newPhoto = page.locator('.aspect-square').first()
    await newPhoto.hover()
    await newPhoto.getByRole('button').click() // koš u fotky
    await expect(page.locator('.aspect-square')).toHaveCount(before)
  })

  test('klient vidí výživový plán a předplatné založené trenérem', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const headers = await authHeader(request, trainer.id)

    const nutritionTitle = uniqueName('E2E Výživa pro klienta')
    const nutRes = await request.post('/api/nutrition-plans', {
      headers,
      data: { client_id: client.id, title: nutritionTitle, daily_calories: 2200 },
    })
    const nutritionPlan = await nutRes.json()

    const subRes = await request.post('/api/subscriptions', {
      headers,
      data: { client_id: client.id, plan_name: uniqueName('E2E Balíček'), price_kc: 990 },
    })
    const subscription = await subRes.json()

    try {
      await loginViaStorage(page, request, client.id)

      await page.goto('/client/nutrition')
      // nutrition-plans nemá DELETE (viz komentář ve finally níže), takže po opakovaných
      // bězích může existovat víc karet se stejnou hodnotou kalorií — scoping na konkrétní
      // kartu podle unikátního titulku místo obecného getByText('2200 kcal').
      const planCard = page.locator('div.rounded-lg.border').filter({ hasText: nutritionTitle })
      await expect(planCard).toBeVisible()
      await expect(planCard).toContainText('2200 kcal')

      await page.goto('/client/billing')
      // Stejný důvod jako u výživového plánu výše — subscriptions se nemažou a "990 Kč"
      // není unikátní, proto scoping na konkrétní kartu podle unikátního plan_name.
      const subCard = page.locator('div.rounded-lg.border').filter({ hasText: subscription.plan_name })
      await expect(subCard).toBeVisible()
      await expect(subCard).toContainText('990 Kč')
    } finally {
      // nutrition-plans a subscriptions nemají DELETE endpoint (POC rozsah) — testovací
      // prostředí je oddělené od produkce (viz CLAUDE.md), takže tahle drobná akumulace dat
      // je přijatelná a neškodí ničemu reálnému.
    }
  })
})
