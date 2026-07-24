import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, getSecondClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// CalendarView.groupByTime() slučuje tréninky různých klientů se stejným datem+časem do
// jednoho řádku ("skupinová lekce") — čistě zobrazovací vrstva, žádný samostatný "team session"
// objekt ve schématu (viz CLAUDE.md). trainer-calendar-and-workouts.spec.js se téhle situaci
// záměrně vyhýbá (aby si test nesloučil kartu pod rukama), takže samotné groupování dosud
// nebylo ověřené vůbec — tenhle test to pokrývá přímo.
test.describe('Trenér — skupinové lekce v kalendáři', () => {
  test('dva klienti ve stejný čas se v denním přehledu zobrazí jako jeden sloučený řádek', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const client1 = await getClient(request)
    const client2 = await getSecondClient(request)
    const headers = await authHeader(request, trainer.id)
    const today = new Date().toISOString().slice(0, 10)
    // 05:30 schválně mimo seedovanou sadu časů (viz seedJulyAugustDemoSchedule v db.php —
    // ['07:00'..'11:00','12:45'..'20:45']), ať se nesloučí s cizím reálným demo tréninkem.
    const time = '05:30'
    const sharedTitle = uniqueName('E2E Skupinová lekce')

    const res1 = await request.post('/api/workouts', {
      headers,
      data: { client_id: client1.id, date: today, time, title: sharedTitle, location: 'E2E Test Gym' },
    })
    const res2 = await request.post('/api/workouts', {
      headers,
      data: { client_id: client2.id, date: today, time, title: sharedTitle, location: 'E2E Test Gym' },
    })
    expect(res1.ok() && res2.ok()).toBeTruthy()
    const workout1 = await res1.json()
    const workout2 = await res2.json()

    try {
      await loginViaStorage(page, request, trainer.id)
      await page.goto('/trainer/calendar') // výchozí režim "Den" je zakotvený na dnešek

      // Scoping přes konkrétní třídu karty (viz TrainerCalendar.jsx: cardClass obsahuje
      // "rounded-lg border p-4"), ne obecně "div, a" + first()/last() — jinak by shoda
      // narazila na některého z ancestor kontejnerů (celý den, #root, ...), co text taky
      // "obsahuje" (viz stejný problém dřív u trainer-calendar-and-workouts.spec.js).
      const row = page.locator('div.rounded-lg.border.p-4').filter({ hasText: sharedTitle })
      await expect(row).toBeVisible()
      // Obě jména klientů se musí objevit v tomtéž řádku (comma-joined), ne ve dvou
      // oddělených kartách.
      await expect(row).toContainText(client1.display_name)
      await expect(row).toContainText(client2.display_name)
    } finally {
      await request.delete(`/api/workouts/${workout1.id}`, { headers })
      await request.delete(`/api/workouts/${workout2.id}`, { headers })
    }
  })
})
