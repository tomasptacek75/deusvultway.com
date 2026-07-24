import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

test.describe('Trenér — knihovna cviků', () => {
  test('vytvoření, úprava a smazání cviku', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer/exercises')

    const name = uniqueName('E2E Cvik')

    await page.getByRole('button', { name: /Nový cvik|New exercise/ }).click()
    await page.getByPlaceholder('Název cviku').fill(name)
    await page.getByPlaceholder('Svalová partie').fill('E2E Test Group')
    await page.getByPlaceholder('Kategorie').fill('E2E Test Kategorie')
    await page.getByRole('button', { name: /Uložit cvik|Save exercise/ }).click()

    const card = page.locator('div.rounded-lg.border', { hasText: name })
    await expect(card).toBeVisible()
    await expect(card).toContainText('E2E Test Group')

    // Úprava — tužka je první ikonové tlačítko v kartě (viz Exercises.jsx: Pencil pak Trash2).
    await card.getByRole('button').nth(0).click()
    const muscleGroupInput = page.getByPlaceholder('Svalová partie').last()
    await muscleGroupInput.fill('E2E Updated Group')
    await page.getByRole('button', { name: /^(Uložit|Save)$/ }).click()
    await expect(card).toContainText('E2E Updated Group')

    // Smazání (úklid) — druhé ikonové tlačítko je koš.
    await card.getByRole('button').nth(1).click()
    await expect(page.getByText(name, { exact: true })).not.toBeVisible()
  })
})
