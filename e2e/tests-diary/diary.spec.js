import { test, expect } from '@playwright/test'
import { registerDiaryUser, loginDiaryUserViaStorage } from '../helpers/diaryAuth.js'

// muj.bloodandguts.cz je samostatný produkt (role 'diary', vlastní DB, vlastní deploy přes
// _ftp_deploy_muj.py — viz CLAUDE.md) — nesdílí nic s test.bloodandguts.cz, kam míří hlavní
// playwright.config.js. Nemá vlastní "test" subdoménu, takže se testuje přímo proti produkci
// s jednorázovým, jasně označeným účtem (viz diaryAuth.js). Proto žije v samostatné složce
// (tests-diary/) s vlastním configem (playwright.diary.config.js), ne v tests/ — kdyby seděl
// ve stejném testDir jako hlavní sada, `deploy_gated.py`'s bezpodmínečné `test` (bez cesty) by
// ho vzal s sebou a zasáhl produkci deníku při každém nasazení hlavní appky. Spouštět ručně
// před `_ftp_deploy_muj.py`:  npx playwright test --config=playwright.diary.config.js

test.describe('Deník (muj.bloodandguts.cz)', () => {
  test('ruční záznam: vlastní váha, předvyplnění nové série, historie', async ({ page, request }) => {
    const user = await registerDiaryUser(request)
    const headers = { Authorization: `Bearer ${user.token}` }
    let entryId = null

    try {
      await loginDiaryUserViaStorage(page, user)
      await page.goto('/diary/manual')

      // První cvik: silový, jedna série s vlastní vahou (shyby).
      await page.locator('input.font-medium').first().fill('Shyby')
      const exerciseCard = page.locator('div.rounded-lg.border').filter({ has: page.locator('input.font-medium') }).first()
      await exerciseCard.getByPlaceholder('opak.').fill('8')
      await exerciseCard.getByRole('checkbox').check()
      // Vlastní váha zaškrtnutá → pole pro kg by nemělo být vidět.
      await expect(exerciseCard.getByPlaceholder('kg')).toHaveCount(0)

      // Přidat druhou sérii — opakování by se mělo předvyplnit podle první (8), jde upravit.
      await exerciseCard.getByRole('button', { name: /Přidat sérii/ }).click()
      const secondSetReps = exerciseCard.locator('input[placeholder="opak."]').nth(1)
      await expect(secondSetReps).toHaveValue('8')
      await secondSetReps.fill('6')

      await page.getByRole('button', { name: /Uložit trénink/ }).click()
      await expect(page).toHaveURL(/\/diary$/)

      // Ověření dat přes API — přesnější než parsovat formátovaný text v historii.
      const entries = await (await request.get('/api/diary/entries', { headers })).json()
      const entry = entries.find((e) => e.exercises.some((ex) => ex.name === 'Shyby'))
      expect(entry, 'záznam se shyby by měl existovat').toBeTruthy()
      entryId = entry.id
      const shyby = entry.exercises.find((ex) => ex.name === 'Shyby')
      expect(shyby.sets).toHaveLength(2)
      expect(shyby.sets[0].own_weight).toBe(true)
      expect(shyby.sets[0].reps).toBe(8)
      expect(shyby.sets[1].own_weight).toBe(true)
      expect(shyby.sets[1].reps).toBe(6)

      // Historie zobrazí "vlastní váha" místo prázdné/nejasné váhy.
      await page.goto('/diary/history')
      await page.getByRole('button', { name: /Shyby/ }).first().click()
      await expect(page.getByText(/vlastní váha/)).toBeVisible()
    } finally {
      if (entryId) await request.delete(`/api/diary/entries/${entryId}`, { headers })
    }
  })

  // Slučování blízkých namluvení (POST /diary/upload, do 120 minut) záměrně nemá automatický
  // e2e test — jediná cesta k němu vede přes reálný Whisper přepis skutečné řeči, což by v CI
  // bylo pomalé/nákladné/nespolehlivé (tichá/syntetická nahrávka skončí jako odmítnutá
  // halucinace, viz commit d9e357e, takže by test ověřoval jen tohle, ne slučování). Ověřeno
  // ručně dvěma reálnými nahrávkami přes curl při vývoji funkce — viz
  // project_bloodandguts_diary_merge_feature memory pro postup, pokud je potřeba zopakovat.
})
