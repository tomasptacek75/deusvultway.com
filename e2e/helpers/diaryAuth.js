import { expect } from '@playwright/test'

// Deník (role 'diary', muj.bloodandguts.cz) má vlastní registraci s heslem — na rozdíl od
// hlavní appky žádný seedovaný "demo trenér/klient" ani /auth/demo-login neexistuje, takže si
// každý testovací běh musí založit vlastní jednorázový účet. E-mail nese prefix e2e- a
// časovou značku (stejný princip jako uniqueName() v testData.js), aby se běhy nekolidovaly.
// Účet samotný appka nedovolí smazat (žádný DELETE /diary/users) — ponechává se, stejně jako
// jiné drobné E2E artefakty v tomhle projektu (viz e2e/README.md).
export async function registerDiaryUser(request) {
  const email = `e2e-diary-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`
  const res = await request.post('/api/diary/register', {
    data: { email, password: 'e2eTestPass123', display_name: `E2E Deník ${Date.now()}` },
  })
  expect(res.ok(), 'POST /api/diary/register by mělo uspět').toBeTruthy()
  const body = await res.json()
  return { ...body.user, email, token: body.access_token }
}

// Stejné localStorage klíče jako loginViaStorage() v auth.js (bg_token/bg_user) — jediný
// rozdíl je zdroj tokenu (registrace/login s heslem, ne demo-login).
export async function loginDiaryUserViaStorage(page, user) {
  await page.addInitScript(({ token: t, user: u }) => {
    window.localStorage.setItem('bg_token', t)
    window.localStorage.setItem('bg_user', u)
  }, { token: user.token, user: JSON.stringify(user) })
  await page.goto('/diary')
}
