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
- `workout-comments-and-gdpr-export.spec.js` — komentáře k tréninku (na rozdíl od komentářů ke
  cviku) a tlačítko "Stáhnout moje data (GDPR export)" na obou dashboardech; UI pro tohle dvoje
  chybělo do 2026-07-24 přesto, že backend endpointy existovaly odjakživa — dostavěno a otestováno
  ve stejný den.
- `portal-client-onboarding.spec.js` — založení nového klienta (osobní i portálový) přes
  formulář na `TrainerDashboard.jsx` (`POST /clients` dřív neexistoval vůbec), badge, přepnutí
  typu na `ClientDetail.jsx`, okamžité přihlášení přes demo-login.
- `equipment-catalog.spec.js` — spravovaný seznam vybavení/posiloven (`Equipment.jsx`): CRUD,
  skrytí/odkrytí (ne smazání), přiřazení konkrétnímu klientovi na záložce Vybavení.
- `content-library.spec.js` — obsahová knihovna (video ukázky, strava, playlisty): sekce+položka
  vidí osobní i portálový klient stejně, skrytí zmizí jen z klientského pohledu.

Ostatní testy se přihlašují rychle přes API + localStorage (`helpers/auth.js`), ne klikáním
přes `/login` — jen `smoke.spec.js` klikací flow testuje samostatně.

### Deník (muj.bloodandguts.cz) — samostatná sada

`tests-diary/diary.spec.js` pokrývá jiný produkt (role `diary`, vlastní DB, vlastní deploy přes
`_ftp_deploy_muj.py` — viz CLAUDE.md): ruční záznam s "vlastní váhou", předvyplnění nové série
podle předchozí, a zobrazení v historii. Žije mimo `tests/` a mimo hlavní `playwright.config.js`
— má vlastní `playwright.diary.config.js`, protože tahle appka nemá vlastní "test" subdoménu a
testuje se přímo proti produkci s jednorázovým účtem (`helpers/diaryAuth.js`). Kdyby seděl ve
stejném `testDir` jako hlavní sada, bezpodmínečné `test` (bez cesty), kterým ho spouští
`deploy_gated.py`, by ho vzal s sebou a zasáhl produkci deníku při každém nasazení hlavní
trenér/klient appky — proto oddělený config i adresář. Spouštět ručně před `_ftp_deploy_muj.py`:

```bash
cd e2e
npm run test:diary
```

Slučování blízkých namluvení (`POST /diary/upload`, do 120 minut) tahle sada záměrně netestuje
— jediná cesta k tomu vede přes reálný Whisper přepis skutečné řeči, což by v CI bylo
pomalé/nespolehlivé. Ověřeno ručně při vývoji funkce (viz `project_bloodandguts_diary_merge_feature`
memory pro postup, pokud je potřeba zopakovat).

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
- **`hasText` přestane matchovat, když text zmizí do hodnoty `<input>`** — pokud řádek po kliknutí
  na "upravit" přejde do editačního režimu (text nahrazený `<input value=...>`), locator postavený
  na `hasText: text` už tu položku znovu nenajde (input value se nepočítá jako textContent).
  Zachytit element PŘED přepnutím do editace (na kliknutí `getByRole('button')` to stačí), na
  samotný input mířit jinak (pozicí, nebo přes obalující strukturu), ne stejným `hasText` znovu.
- **Plně řízený (controlled) checkbox bez optimistického update umí "zablikat" zpět** — mezi
  kliknutím a dokončením async PUT/POST + reload se `checked` prop na moment vrátí ke staré
  hodnotě. Přísné `.check()`/`.uncheck()` (vyžadují stabilní změnu hned po akci) na tohle
  spolehlivě hlásí "Clicking the checkbox did not change its state". Fix: `.click()` +
  `expect(locator).toBeChecked()`/`.not.toBeChecked()`, což počká/opakuje, dokud se to
  neustálí (viz `equipment-catalog.spec.js`).
- **Playwright nemá `getByDisplayValue`** (to je Testing Library API, ne Playwright) — pro cílení
  na `<input>` podle aktuální hodnoty použij pozici/scoping, ne neexistující metodu.
