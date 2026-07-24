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
  plans a subscriptions nemají DELETE endpoint (mimo rozsah POC), takže se v testovací DB
  pomalu hromadí — neškodí (test prostředí nikdy nesdílí data s produkcí, viz CLAUDE.md), ale
  stojí za zvážení přidat DELETE endpoint, kdyby to začalo vadit.
- **Testovací prostředí je jednosměrné** — tahle sada se pouští jen proti `test.bloodandguts.cz`
  nebo lokálnímu dev serveru, nikdy proti produkci.
