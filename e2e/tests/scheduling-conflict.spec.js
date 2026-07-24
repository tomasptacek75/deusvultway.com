import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName, fillTimeSelect } from '../helpers/testData.js'

// findScheduleConflict (frontend/src/utils/schedule.js) + window.confirm je jediná ochrana
// proti dvojímu bookingu (soft warning, ne server-side blok) — CLAUDE.md výslovně varuje, že
// každá nová time-editing plocha ho musí mít zapojený, jinak kolize tiše projde bez varování.
// Bez tohohle testu by regrese (zapomenutý confirm, špatně sestavené okno) prošla nepovšimnuta.
test.describe('Trenér — kolize rozvrhu', () => {
  test('vytvoření tréninku v kolizi s existujícím vyvolá potvrzovací dialog', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const headers = await authHeader(request, trainer.id)
    // Pevné datum daleko v budoucnu — ať test nezávisí na tom, co je zrovna "dnes" seedované
    // (viz seedJulyAugustDemoSchedule v db.php) a nekoliduje s ničím reálným.
    const date = '2027-04-10'

    const existingTitle = uniqueName('E2E Kolize Existující')
    const existingRes = await request.post('/api/workouts', {
      headers,
      data: { client_id: client.id, date, time: '21:00', title: existingTitle },
    })
    expect(existingRes.ok()).toBeTruthy()
    const existingWorkout = await existingRes.json()
    let newWorkoutId = null

    try {
      await loginViaStorage(page, request, trainer.id)
      await page.goto(`/trainer/clients/${client.id}?tab=workouts`)
      await expect(page.getByText(client.display_name)).toBeVisible()

      const newTitle = uniqueName('E2E Kolize Nový')
      const form = page.locator('form').filter({ has: page.getByPlaceholder(/Název tréninku/i) })
      await form.locator('input[type="date"]').fill(date)
      // 21:15 se překrývá s 60minutovým oknem 21:00 tréninku, ale nemá stejný start (přesně
      // shodný čas = záměrná skupinová lekce, ne kolize — viz groupByTime v CalendarView.jsx).
      // TimeSelect.jsx nabízí jen hodiny 07–21, takže mimo tenhle rozsah nejde nic vybrat.
      await fillTimeSelect(form, '21:15')
      await form.getByPlaceholder(/Název tréninku/i).fill(newTitle)

      // createWorkout je async (čeká na GET /schedule než zavolá window.confirm), takže
      // dialog se objeví až chvíli PO tom, co .click() dokončí jen samotné odeslání kliku —
      // page.waitForEvent('dialog') na rozdíl od "page.once + hned zkontrolovat proměnnou"
      // skutečně počká, než se dialog objeví, místo race condition mezi klikem a assercí.
      const dialogPromise1 = page.waitForEvent('dialog')
      await form.getByRole('button', { name: /Přidat|Add/ }).click()
      const dialog1 = await dialogPromise1
      const dialogMessage = dialog1.message()
      await dialog1.dismiss()

      expect(dialogMessage).toContain(client.display_name)
      expect(dialogMessage).toContain('21:00')
      // Zrušený dialog nesmí trénink založit.
      await expect(page.getByText(newTitle)).toHaveCount(0)

      // Podruhé stejný formulář (hodnoty zůstaly vyplněné, protože zrušení dělá early return
      // před resetem formuláře — viz createWorkout v ClientDetail.jsx), tentokrát potvrdit.
      const dialogPromise2 = page.waitForEvent('dialog')
      await form.getByRole('button', { name: /Přidat|Add/ }).click()
      const dialog2 = await dialogPromise2
      await dialog2.accept()
      const row = page.locator('div.rounded-lg.border', { hasText: newTitle })
      await expect(row).toBeVisible()

      const created = await (await request.get('/api/workouts', { headers, params: { client_id: client.id } })).json()
      newWorkoutId = created.find((w) => w.title === newTitle)?.id
      expect(newWorkoutId, 'trénink potvrzený přes dialog se měl skutečně uložit').toBeTruthy()
    } finally {
      await request.delete(`/api/workouts/${existingWorkout.id}`, { headers })
      if (newWorkoutId) await request.delete(`/api/workouts/${newWorkoutId}`, { headers })
    }
  })
})
