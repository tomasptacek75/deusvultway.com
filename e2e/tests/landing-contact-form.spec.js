import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Kontaktní formulář na landing page (ContactForm v Landing.jsx → POST /inquiries) je jediná
// cesta, jak se z veřejné marketingové stránky poptávka dostane až k trenérovi (Inquiries.jsx).
// Dosud netestováno vůbec, i když je to hlavní lead-gen prvek celého veřejného webu.
test.describe('Landing — kontaktní formulář a poptávky', () => {
  test('odeslání formuláře na landing page se objeví v poptávkách u trenéra', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const headers = await authHeader(request, trainer.id)

    const name = uniqueName('E2E Poptávka')
    // Plain ASCII e-mail — HTML5 <input type="email"> validace odmítne diakritiku před
    // '@' ("A part followed by '@' should not contain the symbol 'á'"), takže nejde jen
    // vzít český name a přepsat na lowercase.
    const email = `e2e-${Date.now()}@example.com`
    const message = 'E2E test zprávy z kontaktního formuláře.'

    await page.goto('/')
    await page.getByPlaceholder(/^Jméno$|^Name$/).fill(name)
    await page.getByPlaceholder(/E-mail|Email/).fill(email)
    await page.getByPlaceholder(/O sobě a co od tréninku|About yourself and what you expect/).fill(message)
    await page.getByRole('button', { name: /Odeslat zprávu|Send message/ }).click()

    await expect(page.getByText(/Díky, zpráva je odeslaná|Thanks, your message has been sent/)).toBeVisible()

    await loginViaStorage(page, request, trainer.id)
    await page.goto('/trainer/inquiries')
    const row = page.locator('div.rounded-lg.border', { hasText: name })
    await expect(row).toBeVisible()
    await expect(row).toContainText(email)
    await expect(row).toContainText(message)

    // inquiries nemá DELETE endpoint (viz CLAUDE.md "Current status") — úklid není možný,
    // stejná přijatelná akumulace jako u nutrition-plans/subscriptions (test prostředí je
    // oddělené od produkce).
    const inquiries = await (await request.get('/api/inquiries', { headers })).json()
    expect(inquiries.some((i) => i.name === name)).toBeTruthy()
  })
})
