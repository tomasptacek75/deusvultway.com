import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// offlineQueue.js (frontend/src/offlineQueue.js) je jediná "no data loss" ochrana pro zápis
// sérií při výpadku signálu v posilovně — fronta v localStorage + idempotence přes client_ref.
// Tenhle projekt má po jedné dřívější race-condition ztrátě dat (viz CLAUDE.md) zvýšený nárok
// právě na "žádná data se neztratí", takže zrovna tahle cesta si zaslouží vlastní test, ne jen
// spoléhání na to, že "vypadá to v pořádku".
test.describe('Klient — offline fronta zápisu sérií', () => {
  let trainer, client, headers, exerciseId, workoutId

  test.beforeEach(async ({ request }) => {
    trainer = await getTrainer(request)
    client = await getClient(request)
    headers = await authHeader(request, trainer.id)

    const exRes = await request.post('/api/exercises', {
      headers,
      data: { name: uniqueName('E2E Offline Cvik'), muscle_group: 'E2E' },
    })
    exerciseId = (await exRes.json()).id

    const today = new Date().toISOString().slice(0, 10)
    const wRes = await request.post('/api/workouts', {
      headers,
      data: { client_id: client.id, date: today, title: uniqueName('E2E Offline Trénink') },
    })
    workoutId = (await wRes.json()).id

    await request.post(`/api/workouts/${workoutId}/exercises`, {
      headers,
      data: { exercise_id: exerciseId, target_sets: 3, target_reps: 10, target_weight_kg: 40 },
    })
  })

  test.afterEach(async ({ request }) => {
    if (workoutId) await request.delete(`/api/workouts/${workoutId}`, { headers })
    if (exerciseId) await request.delete(`/api/exercises/${exerciseId}`, { headers })
  })

  test('zápis série bez signálu se uloží do fronty a odešle se po obnovení připojení', async ({ page, request }) => {
    await loginViaStorage(page, request, client.id)
    await page.goto(`/client/workouts/${workoutId}`)

    const card = page.locator('div.rounded-lg.border', { hasText: 'E2E Offline Cvik' })
    await expect(card).toBeVisible()

    await page.context().setOffline(true)

    await card.getByPlaceholder('opak.').fill('6')
    await card.getByPlaceholder('kg').fill('45')
    await card.getByRole('button', { name: /Zapsat sérii|Log set/ }).click()

    // WifiOff badge s počtem čekajících sérií (WorkoutDetail.jsx) — důkaz, že se série
    // zafrontovala místo toho, aby zápis tiše zmizel.
    await expect(page.getByText(/1 série čeká|1 set is waiting/)).toBeVisible()

    await page.context().setOffline(false)
    // initOfflineSync spouští tryFlush() hned při mountu (ne jen na 'online' event nebo
    // 30s interval) — reload po obnovení sítě tak deterministicky vyprázdní frontu, místo
    // aby test spoléhal na to, že prohlížeč věrně vyšle 'online' event.
    await page.reload()

    await expect(page.getByText(/série čeká|série čekají|set is waiting|sets are waiting/)).toHaveCount(0)
    await expect(card).toContainText('6× @ 45 kg')

    const logs = await (await request.get(`/api/workouts/${workoutId}`, { headers })).json()
    const loggedSets = logs.exercises.find((e) => e.exercise_id === exerciseId)?.logs ?? []
    expect(loggedSets.some((l) => l.actual_reps === 6 && l.actual_weight_kg === 45)).toBeTruthy()
  })
})
