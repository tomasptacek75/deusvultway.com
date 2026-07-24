import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'
import { BASE_URL } from '../helpers/baseUrl.js'

// Obě strany chatu (K5) potřebují otevřené najednou, aby šlo ověřit, že zpráva doputuje a
// vyvolá notifikaci (S2) — proto druhý browser context pro klienta místo druhé `page`.
test.describe('Zprávy a notifikace', () => {
  test('trenér a klient si vymění zprávu a trenérovi naskočí notifikace', async ({ page, request, browser }) => {
    const trainer = await getTrainer(request)
    const client = await getClient(request)

    await loginViaStorage(page, request, trainer.id)
    await page.goto(`/trainer/clients/${client.id}?tab=messages`)
    const trainerMsg = uniqueName('E2E Zpráva trenéra')
    await page.getByPlaceholder(/Napiš zprávu/i).fill(trainerMsg)
    await page.getByRole('button', { name: /Odeslat|Send/ }).click()
    await expect(page.getByText(trainerMsg)).toBeVisible()

    const clientContext = await browser.newContext({ baseURL: BASE_URL })
    const clientPage = await clientContext.newPage()
    try {
      await loginViaStorage(clientPage, clientContext.request, client.id)
      await clientPage.goto('/client/messages')
      await expect(clientPage.getByText(trainerMsg)).toBeVisible()

      const clientReply = uniqueName('E2E Odpověď klienta')
      await clientPage.getByPlaceholder(/Napiš zprávu/i).fill(clientReply)
      await clientPage.getByRole('button', { name: /Odeslat|Send/ }).click()
      await expect(clientPage.getByText(clientReply)).toBeVisible()

      // Trenér vidí odpověď po refreshi (chat sám pollujue každých 15s, viz MessagesTab)
      // a dostane notifikaci (bell pooluje zvlášť po 20s) — reload obojí vynutí okamžitě.
      await page.reload()
      await expect(page.getByText(clientReply)).toBeVisible()

      // Tělo notifikace se skládá server-side vždy česky (viz CLAUDE.md — seedovaný/generovaný
      // obsah zůstává česky bez ohledu na EN/CS přepínač) a obsahuje jméno odesílatele.
      // AppShell renderuje zvoneček dvakrát (desktop + mobilní nav, jeden je jen CSS-skrytý),
      // takže getByLabel by narazil na strict-mode chybu — :visible cílí na ten zobrazený.
      await page.locator('[aria-label="Notifikace"]:visible, [aria-label="Notifications"]:visible').click()
      // Text notifikace nemá unikátní identifikátor (vždy stejné "X ti napsal(a) zprávu") a
      // notifikace se nikdy nemažou (jen označují jako přečtené) — opakované běhy testu proti
      // stejné DB tak nechají hromadit duplicity. .first() stačí, ověřuje jen že notifikace
      // vznikla, ne kolikátá v pořadí je.
      await expect(page.getByText(`${client.display_name} ti napsal(a) zprávu`).first()).toBeVisible()
    } finally {
      await clientContext.close()
    }
  })
})
