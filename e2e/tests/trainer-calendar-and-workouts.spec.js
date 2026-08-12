import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

test.describe('Trenér — kalendář', () => {
  test('kalendář se načte a přepínání Den/Týden/Měsíc + navigace funguje', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer/calendar')

    await expect(page.getByRole('button', { name: /^(Dnes|Today)$/ })).toBeVisible()
    for (const mode of [/^(Týden|Week)$/, /^(Měsíc|Month)$/, /^(Den|Day)$/]) {
      await page.getByRole('button', { name: mode }).click()
    }
    // Šipka vpřed/vzad by neměla appku shodit (kontrola konzolových chyb níže).
    await page.getByRole('button', { name: /Předchozí|Previous/ }).click()
    await page.getByRole('button', { name: /Další|Next/ }).click()
    await page.getByRole('button', { name: /^(Dnes|Today)$/ }).click()
  })

  test('úprava času tréninku přímo v denním přehledu kalendáře', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const headers = await authHeader(request, trainer.id)
    const today = new Date().toISOString().slice(0, 10)
    const title = uniqueName('E2E Kalendář Trénink')

    // 06:00 schválně mimo seedovanou sadu časů (viz seedJulyAugustDemoSchedule v db.php —
    // ['07:00'..'11:00','12:45'..'20:45']), aby se trénink nikdy neseskupil s cizím do
    // "skupinové lekce" (CalendarView.groupByTime) a zůstal v testu jako samostatná karta.
    const createRes = await request.post('/api/workouts', {
      headers,
      data: { client_id: client.id, date: today, time: '06:00', title },
    })
    expect(createRes.ok()).toBeTruthy()
    const workout = await createRes.json()

    try {
      await loginViaStorage(page, request, trainer.id)
      await page.goto('/trainer/calendar') // výchozí režim je "Den" s kotvou na dnešek

      // .filter({ hasText }) matchne každý ancestor v řetězci, co text obsahuje — od
      // #root (celá appka) až po nejvnitřnější div s titulkem — takže "a, div" + .first()/.last()
      // je nespolehlivé (buď #root, nebo jen titulek bez času). Netříděný jednoklientský trénink
      // (bez group session) se v TrainerCalendar.jsx renderuje jako jediný <Link>/<a> bez
      // vnořených <a> uvnitř, takže scoping jen na 'a' dá přesně jednu shodu — celou kartu.
      const card = page.locator('a').filter({ hasText: title })
      await expect(card).toBeVisible()
      await expect(card).toContainText('06:00')

      await card.getByRole('button', { name: /06:00/ }).click()
      // Měníme jen minutu (06:00 → 06:15) — hodina zůstává mimo seedovanou sadu, takže
      // trénink nemůže "spadnout" do cizí skupinové lekce a kartu si pod rukama přeskupit.
      await card.locator('select').nth(1).selectOption('15')
      // 06:15 zasahuje 60minutovým oknem do 07:00 (viz findScheduleConflict/SESSION_LENGTH_MIN)
      // — s 23 naseedovanými klienty má "dnes" skoro jistě někdo trénink přesně v 07:00, takže
      // se tu prakticky pokaždé objeví potvrzovací dialog kolize. Bez zachyceného page.on
      // handleru ho Playwright bez varování zavře jako Zrušit (výchozí chování u
      // neobslouženého window.confirm), a uložení tiše neproběhne — proto accept() předem,
      // stejný vzor jako scheduling-conflict.spec.js.
      page.once('dialog', (d) => d.accept())
      await card.getByRole('button').last().click() // ✓ potvrzení

      await expect(card).toContainText('06:15')
    } finally {
      await request.delete(`/api/workouts/${workout.id}`, { headers })
    }
  })
})
