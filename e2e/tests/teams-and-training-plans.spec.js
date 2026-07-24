import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Pokrývá T7 (týmové/skupinové programování) a T1/T4 (tréninkové bloky + generování tréninků
// z bloku, včetně % 1RM/RPE progrese) — jedny z funkčně nejsložitějších částí appky.
test.describe('Trenér — týmy a tréninkové plány', () => {
  let trainer, client, headers, exerciseId, teamId, planId, generatedStartDate

  test.beforeEach(async ({ request }) => {
    trainer = await getTrainer(request)
    client = await getClient(request)
    headers = await authHeader(request, trainer.id)
    const exRes = await request.post('/api/exercises', {
      headers,
      data: { name: uniqueName('E2E Plan Cvik'), muscle_group: 'E2E' },
    })
    exerciseId = (await exRes.json()).id
  })

  test.afterEach(async ({ request }) => {
    if (planId) await request.delete(`/api/training-plans/${planId}`, { headers })
    if (teamId) await request.delete(`/api/teams/${teamId}`, { headers })
    if (exerciseId) await request.delete(`/api/exercises/${exerciseId}`, { headers })
    // generate-workouts vytváří samostatné řádky ve `workouts` bez vazby na plán/blok (FK),
    // takže smazání plánu je samo o sobě neuklidí — smažeme je explicitně přes rozsah dat.
    if (generatedStartDate) {
      const res = await request.get('/api/workouts', {
        headers,
        params: { client_id: client.id, from: generatedStartDate, to: generatedStartDate },
      })
      const workouts = await res.json()
      for (const w of workouts) {
        await request.delete(`/api/workouts/${w.id}`, { headers })
      }
    }
  })

  test('vytvoření týmu, plánu, bloku a vygenerování tréninků', async ({ page, request }) => {
    const teamName = uniqueName('E2E Tým')
    const planName = uniqueName('E2E Plán')
    const blockName = uniqueName('E2E Blok')

    await loginViaStorage(page, request, trainer.id)

    // 1) Tým + člen
    await page.goto('/trainer/teams')
    await page.getByPlaceholder(/Název týmu/i).fill(teamName)
    await page.getByRole('button', { name: /Vytvořit tým|Create team/ }).click()
    const teamCard = page.locator('div.rounded-lg.border', { hasText: teamName })
    await expect(teamCard).toBeVisible()
    await teamCard.getByRole('button', { name: /\+ Přidat člena|Add member/ }).click()
    await teamCard.locator('select').selectOption(String(client.id))
    await teamCard.getByRole('button', { name: /^(Přidat|Add)$/ }).click()
    await expect(teamCard).toContainText(client.display_name)

    // ID týmu zjistíme přes API (potřebujeme ho pro cleanup a nemá smysl parsovat z DOM).
    const teamsRes = await request.get('/api/teams', { headers })
    const teams = await teamsRes.json()
    teamId = teams.find((t) => t.name === teamName).id

    // 2) Tréninkový plán navázaný na tým
    await page.goto('/trainer/plans')
    await page.getByPlaceholder(/Název plánu/i).fill(planName)
    await page.locator('select').selectOption({ label: teamName })
    await page.getByRole('button', { name: /Vytvořit plán|Create plan/ }).click()
    const planRow = page.locator('div.rounded-lg.border', { hasText: planName })
    await expect(planRow).toBeVisible()

    const plansRes = await request.get('/api/training-plans', { headers })
    const plans = await plansRes.json()
    planId = plans.find((p) => p.name === planName).id

    // 3) Blok uvnitř plánu
    await planRow.getByRole('button').filter({ hasText: planName }).click()
    const blockForm = page.locator('form').filter({ has: page.getByPlaceholder(/Název bloku/i) })
    await blockForm.getByPlaceholder(/Název bloku/i).fill(blockName)
    await blockForm.locator('input[type="number"]').first().fill('1') // týdnů
    generatedStartDate = new Date().toISOString().slice(0, 10) // start_date výchozí = dnes
    await blockForm.getByRole('button', { name: /Přidat blok|Add block/ }).click()

    const blockCard = page.locator('div.rounded-md.bg-neutral-950', { hasText: blockName })
    await expect(blockCard).toBeVisible()

    // 4) Cvik do bloku
    await blockCard.locator('select').selectOption(String(exerciseId))
    await blockCard.getByRole('button', { name: /Přidat cvik|Add exercise/ }).click()
    await expect(blockCard).toContainText('E2E Plan Cvik')

    // 5) Generování tréninků z bloku (T4/T7)
    await blockCard.getByRole('button', { name: /Generovat tréninky|Generate workouts/ }).click()
    const resultText = blockCard.getByText(/Vygenerováno|Generated/)
    await expect(resultText).toBeVisible()
    await expect(resultText).toHaveText(/[1-9][0-9]* (tréninků|workouts)/)
  })
})
