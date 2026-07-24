import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// /client/history (History.jsx) — osobní rekordy (odhad 1RM Epleyho vzorcem) a seznam
// dokončených tréninků. Dosud netestováno vůbec, přestože jde o vlastní stránku s vlastní
// logikou (GET /clients/{id}/prs a /clients/{id}/history, viz index.php sekce "PRs, HISTORIE").
test.describe('Klient — historie a osobní rekordy', () => {
  let trainer, client, headers, exerciseId, workoutId

  test.beforeEach(async ({ request }) => {
    trainer = await getTrainer(request)
    client = await getClient(request)
    headers = await authHeader(request, trainer.id)

    const exRes = await request.post('/api/exercises', {
      headers,
      data: { name: uniqueName('E2E Historie Cvik'), muscle_group: 'E2E' },
    })
    exerciseId = (await exRes.json()).id

    const today = new Date().toISOString().slice(0, 10)
    const wRes = await request.post('/api/workouts', {
      headers,
      data: { client_id: client.id, date: today, title: uniqueName('E2E Historie Trénink') },
    })
    workoutId = (await wRes.json()).id

    const weRes = await request.post(`/api/workouts/${workoutId}/exercises`, {
      headers,
      data: { exercise_id: exerciseId, target_sets: 1, target_reps: 5, target_weight_kg: 100 },
    })
    const workoutExerciseId = (await weRes.json()).id

    // PR endpoint nevyžaduje dokončený trénink, jen zalogovanou sérii s váhou i opakováními —
    // historie ale ano (WHERE status='completed'), proto obojí: zalogovat sérii a pak dokončit.
    await request.post(`/api/workout-exercises/${workoutExerciseId}/logs`, {
      headers: await authHeader(request, client.id),
      data: { actual_reps: 5, actual_weight_kg: 100, client_ref: uniqueName('e2e-ref') },
    })
    await request.patch(`/api/workouts/${workoutId}/complete`, { headers: await authHeader(request, client.id) })
  })

  test.afterEach(async ({ request }) => {
    if (workoutId) await request.delete(`/api/workouts/${workoutId}`, { headers })
    if (exerciseId) await request.delete(`/api/exercises/${exerciseId}`, { headers })
  })

  test('nová zalogovaná série a dokončený trénink se objeví jako PR a v historii', async ({ page, request }) => {
    await loginViaStorage(page, request, client.id)
    await page.goto('/client/history')

    // Epleyho vzorec: 100 * (1 + 5/30) = 116.7 (zaokrouhleno na 1 des. místo, viz epley1rm v index.php).
    const prCard = page.locator('div.rounded-lg.border', { hasText: 'E2E Historie Cvik' })
    await expect(prCard).toBeVisible()
    await expect(prCard).toContainText('100 kg')
    await expect(prCard).toContainText('116.7 kg')

    const historyRow = page.locator('div.rounded-lg.border', { hasText: 'E2E Historie Trénink' })
    await expect(historyRow).toBeVisible()
    await historyRow.getByRole('button').click() // rozbalit detail
    await expect(historyRow).toContainText('5×100kg')
  })
})
