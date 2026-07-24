import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// GET/POST /workouts/{id}/comments (workout_comments) a GET /me/export (GDPR) existovaly
// v backendu už dřív, ale nenavazovalo na ně žádné UI (potvrzeno grepem přes frontend/src) —
// dokud tenhle test soubor obsahoval jen API-only ověření. UI teď existuje (CommentThread na
// WorkoutDetail.jsx/ClientDetail.jsx pro komentáře, downloadMyDataExport pro GDPR export),
// takže test prochází skutečnou obrazovkou, ne jen backendovým kontraktem.
test.describe('Komentáře k tréninku a GDPR export', () => {
  test('komentář k tréninku napsaný trenérem uvidí klient na detailu tréninku', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const trainerHeaders = await authHeader(request, trainer.id)

    const title = uniqueName('E2E Komentář Trénink')
    const wRes = await request.post('/api/workouts', {
      headers: trainerHeaders,
      data: { client_id: client.id, date: new Date().toISOString().slice(0, 10), title },
    })
    const workout = await wRes.json()

    try {
      await loginViaStorage(page, request, trainer.id)
      await page.goto(`/trainer/clients/${client.id}?tab=workouts`)
      const row = page.locator('div.rounded-lg.border', { hasText: title })
      await row.getByRole('button').first().click() // rozbalit (chevron)

      const body = uniqueName('E2E Komentář k tréninku')
      const editor = page.locator('div.border-t.border-neutral-800.p-4.space-y-3')
      // editor obsahuje dva <form>: "přidat cvik" a CommentThread — komentářový je poslední v DOM.
      await editor.getByPlaceholder(/Napiš komentář k tréninku/i).fill(body)
      await editor.locator('form button[type="submit"]').last().click()
      await expect(editor).toContainText(body)

      // klient vidí ten samý komentář na svém detailu tréninku
      await loginViaStorage(page, request, client.id)
      await page.goto(`/client/workouts/${workout.id}`)
      await page.getByText(/Zobrazit komentáře k tréninku/i).click()
      await expect(page.getByText(body)).toBeVisible()
    } finally {
      await request.delete(`/api/workouts/${workout.id}`, { headers: trainerHeaders })
    }
  })

  test('tlačítko GDPR export na klientském přehledu stáhne soubor se správnými daty', async ({ page, request }) => {
    const client = await getClient(request)
    const clientHeaders = await authHeader(request, client.id)

    // goals nemá DELETE endpoint (stejně jako nutrition-plans/subscriptions/inquiries) —
    // přijatelná drobná akumulace v odděleném testovacím prostředí, viz CLAUDE.md.
    const goalDescription = uniqueName('E2E GDPR Cíl')
    const goalRes = await request.post('/api/goals', {
      headers: clientHeaders,
      data: { description: goalDescription, target_date: '2027-12-31' },
    })
    expect(goalRes.ok()).toBeTruthy()

    await loginViaStorage(page, request, client.id)
    await page.goto('/client')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText(/Stáhnout moje data|Download my data/i).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^bloodandguts-data-export-\d{4}-\d{2}-\d{2}\.json$/)

    const path = await download.path()
    const fs = await import('node:fs')
    const data = JSON.parse(fs.readFileSync(path, 'utf-8'))

    expect(data.user?.id).toBe(client.id)
    for (const key of ['workouts', 'goals', 'body_metrics', 'nutrition_plans', 'messages', 'subscriptions', 'one_rms', 'progress_photos']) {
      expect(data, `export má obsahovat klíč "${key}"`).toHaveProperty(key)
    }
    expect(data.goals.some((g) => g.description === goalDescription)).toBeTruthy()
  })

  test('tlačítko GDPR export existuje i na trenérském přehledu', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText(/Stáhnout moje data|Download my data/i).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^bloodandguts-data-export-\d{4}-\d{2}-\d{2}\.json$/)

    const path = await download.path()
    const fs = await import('node:fs')
    const data = JSON.parse(fs.readFileSync(path, 'utf-8'))
    expect(data.user?.id).toBe(trainer.id)
  })
})
