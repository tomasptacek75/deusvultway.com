import { test, expect } from '@playwright/test'
import { getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Tyhle dvě věci jsou API-only testy záměrně, ne UI testy: GET/POST /workouts/{id}/comments
// (workout_comments tabulka) i GET /me/export (GDPR) v backendu existují, ale při průchodu
// celého frontendu (grep přes frontend/src) na ně nikde nenavazuje žádná obrazovka/tlačítko —
// jen exercise-level komentáře (workout-exercises/{id}/comments, viz WorkoutDetail.jsx) jsou
// odněkud volatelné z UI. Dokud se pro tohle dvoje UI nepostaví, e2e může ověřit jen to, že
// backendový kontrakt sám o sobě funguje.
test.describe('Backend-only pokrytí (bez navazujícího UI)', () => {
  test('POST/GET /workouts/{id}/comments funguje i bez UI', async ({ request }) => {
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const trainerHeaders = await authHeader(request, trainer.id)
    const clientHeaders = await authHeader(request, client.id)

    const wRes = await request.post('/api/workouts', {
      headers: trainerHeaders,
      data: { client_id: client.id, date: new Date().toISOString().slice(0, 10), title: uniqueName('E2E Komentář Trénink') },
    })
    const workout = await wRes.json()

    try {
      const body = uniqueName('E2E Komentář k tréninku')
      const postRes = await request.post(`/api/workouts/${workout.id}/comments`, { headers: trainerHeaders, data: { body } })
      expect(postRes.ok()).toBeTruthy()

      // klient (druhá strana konverzace) musí ten samý komentář vidět
      const getRes = await request.get(`/api/workouts/${workout.id}/comments`, { headers: clientHeaders })
      expect(getRes.ok()).toBeTruthy()
      const comments = await getRes.json()
      expect(comments.some((c) => c.body === body)).toBeTruthy()
    } finally {
      await request.delete(`/api/workouts/${workout.id}`, { headers: trainerHeaders })
    }
  })

  test('GET /me/export vrátí GDPR data klienta včetně nově vytvořeného cíle', async ({ request }) => {
    const client = await getClient(request)
    const clientHeaders = await authHeader(request, client.id)

    // goals nemá DELETE endpoint (stejně jako nutrition-plans/subscriptions/inquiries) —
    // přijatelná drobná akumulace v odděleném testovacím prostředí, viz CLAUDE.md.
    const goalRes = await request.post('/api/goals', {
      headers: clientHeaders,
      data: { description: uniqueName('E2E GDPR Cíl'), target_date: '2027-12-31' },
    })
    expect(goalRes.ok()).toBeTruthy()
    const goal = await goalRes.json()

    const exportRes = await request.get('/api/me/export', { headers: clientHeaders })
    expect(exportRes.ok()).toBeTruthy()
    const data = await exportRes.json()

    expect(data.user?.id).toBe(client.id)
    for (const key of ['workouts', 'goals', 'body_metrics', 'nutrition_plans', 'messages', 'subscriptions', 'one_rms', 'progress_photos']) {
      expect(data, `export má obsahovat klíč "${key}"`).toHaveProperty(key)
    }
    expect(data.goals.some((g) => g.id === goal.id)).toBeTruthy()
  })
})
