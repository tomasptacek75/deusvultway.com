import { test, expect } from '@playwright/test'
import { loginViaStorage, getTrainer, getClient, getSecondClient, authHeader } from '../helpers/auth.js'
import { uniqueName } from '../helpers/testData.js'

// Malý merch e-shop (trička, kraťasy, doplňky) — appka nemá platební bránu, objednávka je
// jen záznam, který trenér ručně posouvá přes stavy (nová/zaplaceno/vyřízeno/zrušeno),
// stejný princip jako subscriptions/payments. Produkty spravovány stejným
// hide-not-delete vzorem jako equipment_options/tier_services.
test.describe('Trenér a klient — e-shop', () => {
  test('založení produktu s velikostmi, objednávka klientem, změna stavu trenérem', async ({ page, request }) => {
    test.setTimeout(90_000)
    const trainer = await getTrainer(request)
    const client = await getClient(request)
    const headers = await authHeader(request, trainer.id)
    const name = uniqueName('E2E Tričko')

    let productId = null
    try {
      await loginViaStorage(page, request, trainer.id)
      await page.goto('/trainer/shop')

      await page.getByRole('button', { name: /Nový produkt|New product/ }).click()
      const form = page.locator('form').filter({ has: page.getByPlaceholder(/^Název$|^Name$/) })
      await form.getByPlaceholder(/^Název$|^Name$/).fill(name)
      await form.getByPlaceholder('Kč').fill('599')
      await form.getByPlaceholder(/Velikosti/i).fill('S,M,L')
      await form.getByRole('button', { name: /Uložit|Save/ }).click()

      const card = page.locator('div.rounded-lg.border', { hasText: name })
      await expect(card).toBeVisible()

      const products = await (await request.get('/api/shop-products', { headers, params: { include_inactive: 1 } })).json()
      productId = products.find((p) => p.name === name)?.id
      expect(productId, 'produkt se měl založit').toBeTruthy()

      // Klient si objedná konkrétní velikost.
      await loginViaStorage(page, request, client.id)
      await page.goto('/client/shop')
      const clientCard = page.locator('div.rounded-lg.border', { hasText: name })
      await expect(clientCard).toBeVisible()
      await clientCard.locator('select').selectOption('M')
      await clientCard.getByRole('button', { name: /Objednat|Order/ }).click()
      await expect(clientCard.getByRole('button', { name: /Objednáno|Ordered/ })).toBeVisible()

      const myOrders = await (await request.get('/api/shop-orders/me', { headers: await authHeader(request, client.id) })).json()
      const order = myOrders.find((o) => o.product_name === name)
      expect(order, 'objednávka by měla existovat').toBeTruthy()
      expect(order.size).toBe('M')
      expect(order.status).toBe('nová')

      // Klient (jakýkoli, i jiný) nemá roli trenéra — GET /shop-orders (celý přehled
      // objednávek) je requireRole('trainer'), takže musí dostat 403 bez ohledu na to,
      // čí objednávky by se snažil vidět. /shop-orders/me je jediná klientská cesta ke
      // čtení a je vždy omezená na vlastní auth['user_id'], takže cross-client únik dat
      // by tudy ani neměl kudy projít.
      const secondClient = await getSecondClient(request)
      const secondClientHeaders = await authHeader(request, secondClient.id)
      const forbidden = await request.get('/api/shop-orders', { headers: secondClientHeaders })
      expect(forbidden.status()).toBe(403)

      // Trenér vidí objednávku a mění stav.
      await loginViaStorage(page, request, trainer.id)
      await page.goto('/trainer/shop')
      const orderCard = page.locator('div.rounded-lg.border', { hasText: name }).last()
      await expect(orderCard).toBeVisible()
      await orderCard.getByRole('button', { name: /Zaplaceno|Paid/ }).click()
      // Kliknutí spustí async PUT + reload (setOrderStatus), .click() se vrátí hned po
      // DOM eventu, ne po dokončení requestu — počkat na viditelnou změnu odznáčku, než
      // ověřovat přes API, jinak race (viz feedback_bloodandguts memory o async UI akcích).
      await expect(orderCard.getByText(/^Zaplaceno$|^Paid$/)).toBeVisible()

      // I po viditelné změně v UI umí tenhle Forpsi hosting krátce vrátit starou hodnotu na
      // čerstvý GET (stejný jev jako "první request po zápisu" v project_bloodandguts_
      // deploy_quirks memory) — na rozdíl od expect(locator) se čistý expect(hodnota) nikdy
      // neopakuje, proto expect.poll() místo jednorázového požadavku.
      await expect.poll(async () => {
        const afterStatus = await (await request.get('/api/shop-orders', { headers })).json()
        return afterStatus.find((o) => o.id === order.id)?.status
      }).toBe('zaplaceno')
    } finally {
      if (productId) await request.put(`/api/shop-products/${productId}`, { headers, data: { active: 0 } })
    }
  })
})
