import { test, expect } from '@playwright/test'
import { getTrainer, getClient } from '../helpers/auth.js'

// Tohle je jediný soubor, který prochází skutečnou obrazovku /login kliknutím (ostatní testy
// se přihlašují rychleji přes localStorage — viz helpers/auth.js#loginViaStorage). Kdyby se
// login obrazovka rozbila, tenhle soubor to odhalí jako první.
test.describe('Smoke', () => {
  test('landing page se načte', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.ok(), 'landing page by měla vrátit 2xx').toBeTruthy()
  })

  test('/login vypíše seznam osob a trenér se jím přihlásí', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    await page.goto('/login')
    await expect(page.getByText(/POC režim|POC mode/i)).toBeVisible()
    await page.getByRole('button', { name: trainer.display_name, exact: true }).click()
    await page.waitForURL('**/trainer/calendar')
    await expect(page.getByText(trainer.display_name)).toBeVisible()
  })

  test('/login pustí dovnitř i klienta', async ({ page, request }) => {
    const client = await getClient(request)
    await page.goto('/login')
    await page.getByRole('button', { name: client.display_name, exact: true }).click()
    await page.waitForURL('**/client')
    await expect(page.getByText(client.display_name)).toBeVisible()
  })

  test('odhlášení smaže session a vrátí na /login', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    await page.goto('/login')
    await page.getByRole('button', { name: trainer.display_name, exact: true }).click()
    await page.waitForURL('**/trainer/calendar')
    await page.getByTitle(/Odhlásit|Log out/i).click()
    await page.waitForURL('**/login')
    await expect(page.locator('body')).not.toContainText(trainer.display_name)
  })

  test('neautentizovaný přístup na /trainer přesměruje na /login', async ({ page }) => {
    await page.goto('/trainer')
    await page.waitForURL('**/login')
  })

  test('klient nemá přístup na /trainer routy (a naopak)', async ({ page, request }) => {
    const client = await getClient(request)
    await page.goto('/login')
    await page.getByRole('button', { name: client.display_name, exact: true }).click()
    await page.waitForURL('**/client')
    await page.goto('/trainer')
    await page.waitForURL('**/login')
  })

  test('nová navigace pro knihovnu je vidět (portálové rozšíření)', async ({ page, request }) => {
    const trainer = await getTrainer(request)
    await page.goto('/login')
    await page.getByRole('button', { name: trainer.display_name, exact: true }).click()
    await page.waitForURL('**/trainer/calendar')
    // "Vybavení" je od 2026-08-02 schované z menu (routa /trainer/equipment funguje dál),
    // viz App.jsx — nebylo jasné, jestli ho David reálně používá vedle nového klientova
    // vlastního odkazu na gym.
    await expect(page.getByRole('link', { name: /^(Knihovna|Library)$/ })).toBeVisible()

    const client = await getClient(request)
    await page.getByTitle(/Odhlásit|Log out/i).click()
    await page.waitForURL('**/login')
    await page.getByRole('button', { name: client.display_name, exact: true }).click()
    await page.waitForURL('**/client')
    await expect(page.getByRole('link', { name: /^(Knihovna|Library)$/ })).toBeVisible()
  })
})
