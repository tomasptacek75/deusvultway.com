# BloodAndGuts — e2e testy

Playwright sada, která ověřuje appku end-to-end proti běžícímu webu (ne proti buildu na
disku). Účel: gate před produkčním deployem — viz `deploy_gated.py` v rootu repa a sekce
"Deploy" v `CLAUDE.md`.

## Co pokrývá

- `smoke.spec.js` — landing, přihlášení/odhlášení oběma rolemi přes skutečnou `/login`
  obrazovku, role-gating routes.
- `trainer-exercises.spec.js` — knihovna cviků (CRUD).
- `trainer-client-detail.spec.js` — detail klienta: tréninky (vytvoření/přidání cviku/smazání),
  výživa, 1RM, platby.
- `trainer-calendar-and-workouts.spec.js` — kalendář (Den/Týden/Měsíc, navigace), úprava času
  tréninku přímo v přehledu.
- `teams-and-training-plans.spec.js` — týmy, tréninkové plány, bloky, generování tréninků
  z bloku (T4/T7).
- `client-workout-logging.spec.js` — klient zapíše sérii, okomentuje cvik, dokončí trénink.
- `client-progress-and-photos.spec.js` — cíle, míry, fotky pokroku, zobrazení výživy/plateb
  založených trenérem.
- `messaging-and-notifications.spec.js` — chat trenér↔klient + notifikace.
- `i18n.spec.js` — přepínač CS/EN.
- `scheduling-conflict.spec.js` — dialog s varováním při kolizi dvou tréninků (`window.confirm`),
  zrušení nesmí trénink založit, potvrzení musí.
- `group-sessions.spec.js` — dva klienti ve stejný čas se v denním přehledu sloučí do jednoho
  řádku (`groupByTime` v `CalendarView.jsx`).
- `offline-queue.spec.js` — zápis série bez signálu se uloží do localStorage fronty a odešle se
  po obnovení připojení (`offlineQueue.js`).
- `landing-contact-form.spec.js` — kontaktní formulář na landing page → poptávka u trenéra.
- `client-history-and-prs.spec.js` — osobní rekordy (odhad 1RM) a dokončené tréninky na
  `/client/history`.
- `workout-comments-and-gdpr-export.spec.js` — API-only testy (bez UI): `GET/POST
  /workouts/{id}/comments` a `GET /me/export` existují v backendu, ale zatím na ně nenavazuje
  žádná obrazovka v `frontend/src` — dokud se UI nepostaví, ověřuje se jen backendový kontrakt.

Ostatní testy se přihlašují rychle přes API + localStorage (`helpers/auth.js`), ne klikáním
přes `/login` — jen `smoke.spec.js` klikací flow testuje samostatně.

## Spuštění

```bash
cd e2e
npm install
npx playwright install --with-deps chromium   # jen poprvé
npm test                                      # proti test.bloodandguts.cz
```

Proti jinému prostředí (např. lokální dev server):

```bash
E2E_BASE_URL=http://localhost:5310 npm test
```

`npm run test:headed` pustí testy s viditelným prohlížečem, `npm run test:ui` otevře
Playwright UI mód (krokování, time-travel debugging), `npm run report` otevře poslední HTML
report.

## Poznámky k designu

- **Sériový běh (`workers: 1`)** — testy sdílí jednu živou testovací SQLite DB přes REST API,
  paralelní běh by riskoval kolize (dva testy sáhnou na stejného "prvního klienta" najednou).
- **Úklid po sobě** — všechna vytvořená data nesou prefix `E2E` a časovou značku
  (`helpers/testData.js#uniqueName`) a testy je na konci mažou přes API. Výjimka: nutrition
  plans, subscriptions, inquiries a goals nemají DELETE endpoint (mimo rozsah POC), takže se
  v testovací DB pomalu hromadí — neškodí (test prostředí nikdy nesdílí data s produkcí, viz
  CLAUDE.md), ale stojí za zvážení přidat DELETE endpointy, kdyby to začalo vadit. Pozor: kde
  se kvůli tomu opakovaně objevuje nejednoznačný text (např. víc karet se stejnou hodnotou
  "2500 kcal"), assertions musí scopovat na konkrétní kartu podle unikátního titulku/jména
  (`div.rounded-lg.border` + `.filter({ hasText })`), ne na obecný `getByText` — jinak po
  několika bězích spadnou na strict-mode chybě (viz historie commitů).
- **Testovací prostředí je jednosměrné** — tahle sada se pouští jen proti `test.bloodandguts.cz`
  nebo lokálnímu dev serveru, nikdy proti produkci.
