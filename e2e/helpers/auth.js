import { expect } from '@playwright/test'

// GET /auth/people je veřejný endpoint (POC bez hesla, viz CLAUDE.md) — vrací seznam všech
// uživatelů s rolí. Testy ho používají jako zdroj pravdy o tom, kdo v seedovaných datech
// existuje, místo aby si natvrdo pamatovaly konkrétní ID (ta se můžou lišit běh od běhu podle
// pořadí seedování).
export async function fetchPeople(request) {
  const res = await request.get('/api/auth/people')
  expect(res.ok(), 'GET /api/auth/people by mělo vrátit 200').toBeTruthy()
  return res.json()
}

export async function getTrainer(request) {
  const people = await fetchPeople(request)
  const trainer = people.find((p) => p.role === 'trainer')
  expect(trainer, 'seedovaná data musí obsahovat trenéra').toBeTruthy()
  return trainer
}

// Bez displayName vrátí prvního klienta v abecedním pořadí (API řadí podle role, display_name)
// — deterministické napříč testy v rámci jednoho běhu.
export async function getClient(request, { displayName } = {}) {
  const people = await fetchPeople(request)
  const client = displayName
    ? people.find((p) => p.role === 'client' && p.display_name === displayName)
    : people.find((p) => p.role === 'client')
  expect(client, 'seedovaná data musí obsahovat aspoň jednoho klienta').toBeTruthy()
  return client
}

export async function getSecondClient(request) {
  const people = await fetchPeople(request)
  const clients = people.filter((p) => p.role === 'client')
  expect(clients.length, 'seedovaná data musí obsahovat aspoň dva klienty').toBeGreaterThanOrEqual(2)
  return clients[1]
}

// POST /auth/demo-login nevyžaduje heslo (záměrný POC stav) — vydá JWT pro libovolné user_id.
// Testy toho využívají pro rychlé API-only přihlášení bez klikání přes /login formulář.
export async function apiToken(request, userId) {
  const res = await request.post('/api/auth/demo-login', { data: { user_id: userId } })
  expect(res.ok(), `demo-login pro uživatele ${userId} by mělo uspět`).toBeTruthy()
  const body = await res.json()
  return body.access_token
}

export async function authHeader(request, userId) {
  const token = await apiToken(request, userId)
  return { Authorization: `Bearer ${token}` }
}

// Přihlásí prohlížeč rovnou zápisem do localStorage (stejné klíče jako api/client.js:
// bg_token/bg_user) — rychlejší a nezávislé na tom, jestli obrazovka /login zrovna funguje
// (tu ověřuje samostatně smoke.spec.js přes skutečné kliknutí).
export async function loginViaStorage(page, request, userId) {
  const token = await apiToken(request, userId)
  const meRes = await request.get('/api/me', { headers: { Authorization: `Bearer ${token}` } })
  expect(meRes.ok(), 'GET /api/me s čerstvým tokenem by mělo uspět').toBeTruthy()
  const user = await meRes.json()

  await page.addInitScript(({ token: t, user: u }) => {
    window.localStorage.setItem('bg_token', t)
    window.localStorage.setItem('bg_user', u)
  }, { token, user: JSON.stringify(user) })

  await page.goto(user.role === 'trainer' ? '/trainer/calendar' : '/client')
  return { user, token }
}
