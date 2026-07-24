import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Klientova nejdůležitější obrazovka za chodu tréninku: zapsání série, komentář ke cviku,
// dokončení tréninku (T3 adherence, S2 notifikace trenérovi). Trénink i cvik do něj se
// zakládají přes API (rychlejší, spolehlivější setup) — samotný test pak ověřuje UI chování.
test.describe('Klient — zápis tréninku', () => {
  let trainer, client, trainerHeaders, exerciseId, workoutId

  test.beforeEach(async ({ request }) => {
    trainer = await getTrainer(request)
    client = await getClient(request)
    trainerHeaders = await authHeader(request, trainer.id)

    const exRes = await request.post('/api/exercises', {
      headers: trainerHeaders,
      data: { name: uniqueName('E2E Log Cvik'), muscle_group: 'E2E' },
    })
    exerciseId = (await exRes.json()).id

    const today = new Date().toISOString().slice(0, 10)
    const wRes = await request.post('/api/workouts', {
      headers: trainerHeaders,
      data: { client_id: client.id, date: today, title: uniqueName('E2E Log Trénink') },
    })
    workoutId = (await wRes.json()).id

    await request.post(`/api/workouts/${workoutId}/exercises`, {
      headers: trainerHeaders,
      data: { exercise_id: exerciseId, target_sets: 3, target_reps: 10, target_weight_kg: 50 },
    })
  })

  test.afterEach(async ({ request }) => {
    if (workoutId) await request.delete(`/api/workouts/${workoutId}`, { headers: trainerHeaders })
    if (exerciseId) await request.delete(`/api/exercises/${exerciseId}`, { headers: trainerHeaders })
  })

  test('klient zapíše sérii, přidá komentář a dokončí trénink', async ({ page, request }) => {
    await loginViaStorage(page, request, client.id)
    await page.goto(`/client/workouts/${workoutId}`)

    const card = page.locator('div.rounded-lg.border', { hasText: 'E2E Log Cvik' })
    await expect(card).toBeVisible()

    await card.getByPlaceholder('opak.').fill('8')
    await card.getByPlaceholder('kg').fill('52.5')
    await card.getByPlaceholder('RPE').fill('8')
    await card.getByRole('button', { name: /Zapsat sérii|Log set/ }).click()

    await expect(card).toContainText('8× @ 52.5 kg')
    await expect(card).toContainText('RPE 8')

    await card.getByRole('button', { name: /Zobrazit komentáře|Show comments/ }).click()
    const commentText = uniqueName('E2E Komentář klienta')
    await card.getByPlaceholder(/Napiš komentář|Write a comment/).fill(commentText)
    await card.locator('form button[type="submit"]').last().click()
    await expect(card).toContainText(commentText)

    await page.getByRole('button', { name: /Dokončit trénink|Complete workout/ }).click()
    await expect(page.getByText('Dokončeno')).toBeVisible()
  })
})
