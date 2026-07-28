import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Před tímhle neexistoval v appce vůbec žádný způsob, jak založit nového klienta (POST /clients
// nebyl nikde) — celá klientela vznikala jen ručním seedem v db.php. Tenhle test ověřuje první
// blokující krok portálového rozšíření: David může založit portálového klienta přes UI a ten se
// hned může přihlásit, stejně jako kterýkoli jiný klient (passwordless POC model).
test.describe('Trenér — založení nového klienta (portál)', () => {
  test('založení portálového klienta přes formulář, badge, přepnutí typu, okamžité přihlášení', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    const headers = await authHeader(request, trainer.id)
    const name = uniqueName('E2E Portal Klient')
    const email = `e2e-portal-${Date.now()}@example.com`
    let clientId = null

    try {
      await loginViaStorage(page, request, trainer.id)
      await page.goto('/trainer')

      await page.getByRole('button', { name: /Nový klient|New client/ }).click()
      const form = page.locator('form').filter({ has: page.getByPlaceholder(/E-mail|Email/) })
      await form.getByPlaceholder(/E-mail|Email/).fill(email)
      await form.getByPlaceholder(/^Jméno$|^Name$/).fill(name)
      await form.locator('select').selectOption('portal')
      await form.getByRole('button', { name: /Založit klienta|Create client/ }).click()

      const card = page.locator('a', { hasText: name })
      await expect(card).toBeVisible()
      await expect(card).toContainText(/Portál|Portal/)

      const created = await (await request.get('/api/clients', { headers, params: { client_type: 'portal' } })).json()
      const match = created.find((c) => c.email === email)
      expect(match, 'nově založený klient by měl mít client_type=portal').toBeTruthy()
      clientId = match.id

      // Okamžité přihlášení — passwordless demo-login musí fungovat i pro čerstvě založeného klienta.
      const loginRes = await request.post('/api/auth/demo-login', { data: { user_id: clientId } })
      expect(loginRes.ok()).toBeTruthy()

      // Přepnutí typu zpět na osobní na ClientDetail — scoping přes .font-display (jméno
      // klienta + select vedle něj), ať to nekoliduje s TimeSelect hodinovým <select> na
      // výchozí záložce Tréninky.
      await card.click()
      const typeSelect = page.locator('.font-display').locator('select')
      await typeSelect.selectOption('personal')
      await expect(typeSelect).toHaveValue('personal')
    } finally {
      if (clientId) await request.delete(`/api/clients/${clientId}`, { headers }) // soft-delete (active=0)
    }
  })
})
