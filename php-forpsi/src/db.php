<?php
declare(strict_types=1);

function db(array $config): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $path = $config['db_path'];
    $dir  = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    // DELETE, ne WAL — WAL vyžaduje spolehlivé shared-memory zámky mezi procesy, což
    // sdílený/síťový hosting (Forpsi) nepodporuje spolehlivě (viz stejný vzor u Kamata.cz).
    $pdo->exec('PRAGMA journal_mode = DELETE');

    initSchema($pdo, $config);
    return $pdo;
}

function initSchema(PDO $pdo, array $config): void
{
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        role          TEXT NOT NULL DEFAULT 'client',
        display_name  TEXT NOT NULL,
        phone         TEXT,
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goals (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        description   TEXT NOT NULL,
        target_metric TEXT,
        target_value  REAL,
        target_date   TEXT,
        status        TEXT NOT NULL DEFAULT 'active',
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_goals_client ON goals(client_id);

    CREATE TABLE IF NOT EXISTS body_metrics (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date       TEXT NOT NULL,
        weight_kg  REAL,
        waist_cm   REAL,
        chest_cm   REAL,
        hips_cm    REAL,
        arm_cm     REAL,
        thigh_cm   REAL,
        notes      TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(client_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_bm_client ON body_metrics(client_id);

    CREATE TABLE IF NOT EXISTS exercises (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        muscle_group    TEXT,
        cues            TEXT,
        video_url       TEXT,
        name_en         TEXT,
        muscle_group_en TEXT,
        cues_en         TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ex_trainer ON exercises(trainer_id);

    CREATE TABLE IF NOT EXISTS workouts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trainer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date       TEXT NOT NULL,
        title      TEXT NOT NULL,
        notes      TEXT,
        status     TEXT NOT NULL DEFAULT 'planned',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_w_client ON workouts(client_id);
    CREATE INDEX IF NOT EXISTS idx_w_date ON workouts(date);

    CREATE TABLE IF NOT EXISTS workout_exercises (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id        INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id       INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        \"order\"         INTEGER DEFAULT 0,
        target_sets       INTEGER,
        target_reps       INTEGER,
        target_weight_kg  REAL,
        notes             TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);

    CREATE TABLE IF NOT EXISTS exercise_logs (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
        set_number          INTEGER NOT NULL,
        actual_reps         INTEGER,
        actual_weight_kg    REAL,
        note                TEXT,
        logged_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_el_we ON exercise_logs(workout_exercise_id);

    CREATE TABLE IF NOT EXISTS inquiries (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL,
        phone      TEXT,
        message    TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nutrition_plans (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trainer_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title           TEXT NOT NULL,
        notes           TEXT,
        daily_calories  INTEGER,
        daily_protein_g INTEGER,
        daily_carbs_g   INTEGER,
        daily_fat_g     INTEGER,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_np_client ON nutrition_plans(client_id);

    -- ── Týmy (T7 skupinové programování) ──────────────────────────────
    CREATE TABLE IF NOT EXISTS teams (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS team_members (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id   INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(team_id, client_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tm_team ON team_members(team_id);

    -- ── 1RM (T4 progrese, T7 týmové škálování, K3 graf) ───────────────
    CREATE TABLE IF NOT EXISTS client_one_rms (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        value_kg    REAL NOT NULL,
        recorded_at TEXT NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_orm_client_ex ON client_one_rms(client_id, exercise_id);

    -- ── Tréninkové plány / bloky / mezocykly (T1, T4, T7) ─────────────
    CREATE TABLE IF NOT EXISTS training_plans (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id     INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        client_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        description TEXT,
        status      TEXT NOT NULL DEFAULT 'active',
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tp_trainer ON training_plans(trainer_id);

    CREATE TABLE IF NOT EXISTS plan_blocks (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id            INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
        name               TEXT NOT NULL,
        order_num          INTEGER NOT NULL DEFAULT 0,
        weeks              INTEGER NOT NULL DEFAULT 1,
        days_per_week      INTEGER NOT NULL DEFAULT 3,
        progression_type   TEXT NOT NULL DEFAULT 'manual',
        target_rpe         REAL,
        percent_1rm_start  REAL,
        percent_1rm_end    REAL,
        start_date         TEXT,
        created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pb_plan ON plan_blocks(plan_id);

    CREATE TABLE IF NOT EXISTS block_exercises (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        block_id    INTEGER NOT NULL REFERENCES plan_blocks(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL DEFAULT 1,
        \"order\"     INTEGER DEFAULT 0,
        target_sets INTEGER,
        target_reps INTEGER,
        notes       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_be_block ON block_exercises(block_id);

    -- ── Komentáře (S3, T5 zpětná vazba k technice) ────────────────────
    CREATE TABLE IF NOT EXISTS exercise_comments (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
        author_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body                TEXT NOT NULL,
        video_timestamp_sec INTEGER,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ec_we ON exercise_comments(workout_exercise_id);

    CREATE TABLE IF NOT EXISTS workout_comments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body       TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wc_workout ON workout_comments(workout_id);

    -- ── Zprávy a notifikace (K5, S2) ───────────────────────────────────
    CREATE TABLE IF NOT EXISTS messages (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body         TEXT NOT NULL,
        read_at      DATETIME,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(sender_id, recipient_id);

    CREATE TABLE IF NOT EXISTS notifications (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       TEXT NOT NULL,
        body       TEXT NOT NULL,
        link       TEXT,
        read_at    DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

    -- ── Předplatné a platby (T6) — bez napojení na platební bránu, ─────
    -- trenér zaznamenává platby ručně (viz CLAUDE.md o chybějících API klíčích).
    CREATE TABLE IF NOT EXISTS subscriptions (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_name           TEXT NOT NULL,
        price_kc            INTEGER NOT NULL,
        billing_period      TEXT NOT NULL DEFAULT 'monthly',
        status              TEXT NOT NULL DEFAULT 'active',
        current_period_end  TEXT,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sub_client ON subscriptions(client_id);

    CREATE TABLE IF NOT EXISTS payments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount_kc       INTEGER NOT NULL,
        method          TEXT,
        note            TEXT,
        paid_at         TEXT NOT NULL,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pay_sub ON payments(subscription_id);

    -- ── Fotky pokroku (K6) ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS progress_photos (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date       TEXT NOT NULL,
        file_path  TEXT NOT NULL,
        note       TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pp_client ON progress_photos(client_id);

    -- ── Vybavení / posilovny (portál) — spravovaný seznam, ne volný text, na rozdíl od
    -- workouts.location. `equipment_options` je čistě katalog kusů vybavení (guma, jednoručky...);
    -- posilovny žijí ve vlastní tabulce `gyms`, každá s vlastním seznamem vybavení (gym_equipment),
    -- protože různé posilovny mají různé vybavení — nejde o jeden společný zaškrtávací seznam.
    CREATE TABLE IF NOT EXISTS equipment_options (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        name_en    TEXT,
        kind       TEXT NOT NULL DEFAULT 'equipment',
        order_num  INTEGER NOT NULL DEFAULT 0,
        active     INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_eo_trainer ON equipment_options(trainer_id);

    CREATE TABLE IF NOT EXISTS client_equipment (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        equipment_id INTEGER NOT NULL REFERENCES equipment_options(id) ON DELETE CASCADE,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(client_id, equipment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ceq_client ON client_equipment(client_id);

    CREATE TABLE IF NOT EXISTS gyms (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        name_en    TEXT,
        active     INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gym_trainer ON gyms(trainer_id);

    -- Které kusy vybavení (z equipment_options) konkrétní posilovna má — spravuje trenér jednou
    -- za posilovnu, ne opakovaně za každého klienta, co tam chodí.
    CREATE TABLE IF NOT EXISTS gym_equipment (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        gym_id       INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
        equipment_id INTEGER NOT NULL REFERENCES equipment_options(id) ON DELETE CASCADE,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(gym_id, equipment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ge_gym ON gym_equipment(gym_id);

    -- ── Knihovna obsahu (portál) — videa/strava/playlisty/cokoli dalšího, viditelné všem
    -- klientům (osobní i portál). Hide-not-delete přes `active`, stejný vzor jako users.active.
    CREATE TABLE IF NOT EXISTS content_sections (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        title_en   TEXT,
        order_num  INTEGER NOT NULL DEFAULT 0,
        active     INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cs_trainer ON content_sections(trainer_id);

    CREATE TABLE IF NOT EXISTS content_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL REFERENCES content_sections(id) ON DELETE CASCADE,
        type       TEXT NOT NULL DEFAULT 'video',
        title      TEXT NOT NULL,
        title_en   TEXT,
        body       TEXT,
        body_en    TEXT,
        url        TEXT,
        order_num  INTEGER NOT NULL DEFAULT 0,
        active     INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ci_section ON content_items(section_id);

    -- ── Hlasový tréninkový deník (muj.bloodandguts.cz) — samostatný produkt pro roli 'diary',
    -- žádný trenér/klient vztah. Cviky jsou volný text (žádný katalog jako exercises), protože
    -- jde o jednoho uživatele bez trenéra, který si vede vlastní historii.
    CREATE TABLE IF NOT EXISTS diary_entries (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recorded_at TEXT NOT NULL,
        transcript  TEXT,
        ai_raw_json TEXT,
        status      TEXT NOT NULL DEFAULT 'parsed',
        notes       TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_diary_entries_user ON diary_entries(user_id, recorded_at);

    CREATE TABLE IF NOT EXISTS diary_sets (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id      INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
        exercise_name TEXT NOT NULL,
        exercise_type TEXT NOT NULL DEFAULT 'strength',
        order_num     INTEGER NOT NULL DEFAULT 0,
        set_number    INTEGER NOT NULL,
        reps          INTEGER,
        weight_kg     REAL,
        duration_min  REAL,
        distance_km   REAL,
        note          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_diary_sets_entry ON diary_sets(entry_id);

    CREATE TABLE IF NOT EXISTS diary_audio_uploads (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entry_id             INTEGER REFERENCES diary_entries(id) ON DELETE SET NULL,
        file_path            TEXT NOT NULL,
        mime_type            TEXT,
        transcription_status TEXT NOT NULL DEFAULT 'pending',
        error_message        TEXT,
        created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_diary_audio_user ON diary_audio_uploads(user_id);

    CREATE TABLE IF NOT EXISTS diary_suggestions (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_snapshot        TEXT,
        suggestion_json      TEXT NOT NULL,
        based_on_entry_count INTEGER NOT NULL DEFAULT 0,
        created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_diary_suggestions_user ON diary_suggestions(user_id, created_at);

    -- Reset hesla (zatím jen role 'diary', viz api/index.php /diary/reset-*). Ukládá se hash
    -- tokenu, ne token samotný — únik DB tak nedá funkční reset odkaz. Jednorázové (used_at).
    CREATE TABLE IF NOT EXISTS password_resets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at    DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_resets(user_id);
    CREATE INDEX IF NOT EXISTS idx_pwreset_token ON password_resets(token_hash);
    ");

    // Všechny ALTER TABLE pokusy a seed/backfill funkce níž jsou samy o sobě idempotentní, ale
    // až do teď se spouštěly (a všechny svoje kontrolní SELECTy/UPDATy odpaly) na úplně každý
    // request — desítky zbytečných dotazů + ~15 vždy odchycených výjimek z ALTER TABLE na už
    // existující sloupce, na každé jedno volání API. To se ukázalo jako reálné zpomalení
    // (~300–500 ms navíc na request, změřeno 2026-07-24 — i prázdná 404 trasa byla stejně
    // pomalá jako plnohodnotný endpoint). `PRAGMA user_version` slouží jako jednorázová
    // pojistka: po prvním úspěšném průchodu se celý blok už nikdy znovu nevykoná, jen se
    // přečte jedno číslo. `CREATE TABLE IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS` výš
    // zůstávají mimo tuhle bránu (jsou samy o sobě levé přes sqlite_master a musí proběhnout
    // i na úplně čerstvé DB předtím, než tahle brána vůbec dává smysl).
    $schemaVersion = (int) $pdo->query('PRAGMA user_version')->fetchColumn();
    if ($schemaVersion < 1) {
    // ── Idempotentní ALTER TABLE pro sloupce přibylé po prvním nasazení
    // těchto tabulek (stejný vzor jako inquiries.phone / exercise_logs.note níže).
    try { $pdo->exec("ALTER TABLE workout_exercises ADD COLUMN target_rpe REAL"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE exercise_logs ADD COLUMN rpe REAL"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE exercise_logs ADD COLUMN client_ref TEXT"); } catch (\Exception) {}
    try {
        $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_el_client_ref ON exercise_logs(client_ref) WHERE client_ref IS NOT NULL");
    } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE workouts ADD COLUMN completed_at DATETIME"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE exercises ADD COLUMN category TEXT"); } catch (\Exception) {}
    // Anglické varianty pro seedovaná demo cvičení (EN/CS přepínač jazyka, 2026-07-23) —
    // trenérovy vlastní cviky bez name_en zůstávají zobrazené v původním jazyce bez ohledu na toggle.
    try { $pdo->exec("ALTER TABLE exercises ADD COLUMN name_en TEXT"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE exercises ADD COLUMN muscle_group_en TEXT"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE exercises ADD COLUMN cues_en TEXT"); } catch (\Exception) {}
    // Čas a místo tréninku — kalendářní záznamy je předtím neměly (K1, S4).
    try { $pdo->exec("ALTER TABLE workouts ADD COLUMN time TEXT"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE workouts ADD COLUMN location TEXT"); } catch (\Exception) {}
    // Výchozí čas/místo pro tréninky generované z bloku plánu (dědí je při generate-workouts).
    try { $pdo->exec("ALTER TABLE plan_blocks ADD COLUMN default_time TEXT"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE plan_blocks ADD COLUMN default_location TEXT"); } catch (\Exception) {}
    // Profilová fotka klienta — trenér ji vidí u naplánovaného tréninku v kalendáři.
    try { $pdo->exec("ALTER TABLE users ADD COLUMN avatar_path TEXT"); } catch (\Exception) {}
    // Telefon — trenér ho chce v přehledu klientů místo e-mailu (2026-07-24).
    try { $pdo->exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (\Exception) {}

    seedDemoData($pdo, $config);
    seedAdditionalClientData($pdo);
    backfillExerciseTranslations($pdo);
    seedExtraDemoClients($pdo, $config);
    seedJulyAugustDemoSchedule($pdo);
    backfillDemoPhones($pdo);
    // Oprava e-mailu trenéra na DB, které se naseedovaly ještě před tím, než David dodal
    // svůj skutečný kontakt — idempotentní, bezpečné spouštět na každý request.
    $pdo->exec("UPDATE users SET email='tyylle@seznam.cz' WHERE role='trainer' AND email='david@bloodandguts.cz'");
    // Notifikace vytvořené před opravou notifyLink() (2026-07-23) měly natvrdo uložený odkaz
    // na neexistující routy (/messages, /workout-exercises/{id}, /workouts/{id}) — klik na ně
    // spadl na SPA fallback a vypadalo to jako neúmyslné odhlášení, i když token zůstal platný.
    // Oprava kódu se na už uložené řádky nevztahuje, proto je smažeme; nové notifikace od teď
    // vznikají rovnou se správným odkazem (viz notifyLink() v api/index.php).
    try { $pdo->exec("DELETE FROM notifications WHERE link = '/messages' OR link LIKE '/workout-exercises/%' OR link LIKE '/workouts/%'"); } catch (\Exception) {}
    // Sloupec phone přibyl do inquiries až po prvním nasazení — ALTER TABLE na existující
    // produkční DB, no-op (chytne se do catch) na DB, kde už sloupec je.
    try { $pdo->exec("ALTER TABLE inquiries ADD COLUMN phone TEXT"); } catch (\Exception) {}
    // Klientův komentář k zalogované sérii (reálné opakování/váha a proč) — přibyl až po
    // prvním nasazení.
    try { $pdo->exec("ALTER TABLE exercise_logs ADD COLUMN note TEXT"); } catch (\Exception) {}

    $pdo->exec('PRAGMA user_version = 1');
    }

    if ($schemaVersion < 2) {
    // Typ klienta (portál vs. 1:1) — volný text jako users.role, jen dvě hodnoty se skutečně
    // používají, nic to nevynucuje na úrovni DB (stejná konvence jako role).
    try { $pdo->exec("ALTER TABLE users ADD COLUMN client_type TEXT NOT NULL DEFAULT 'personal'"); } catch (\Exception) {}
    // Kategorie cenového tieru portálového předplatného — volný text jako plan_name; David
    // ještě nedodal finální náplň/názvy 3 variant (viz TIERS v Landing.jsx), proto žádný enum.
    try { $pdo->exec("ALTER TABLE subscriptions ADD COLUMN tier TEXT"); } catch (\Exception) {}

    seedPortalDemoData($pdo);

    $pdo->exec('PRAGMA user_version = 2');
    }

    if ($schemaVersion < 3) {
    // Kterou posilovnu (pokud nějakou) klient navštěvuje — určuje, jestli appka bere vybavení
    // z gyms/gym_equipment (posilovna) nebo z client_equipment (doma), viz EquipmentTab.
    try { $pdo->exec("ALTER TABLE users ADD COLUMN gym_id INTEGER REFERENCES gyms(id)"); } catch (\Exception) {}

    migrateGymsFromEquipmentOptions($pdo);

    $pdo->exec('PRAGMA user_version = 3');
    }

    if ($schemaVersion < 4) {
    // Cíl uživatele hlasového deníku (síla/objem/mix) — volný text jako role/client_type,
    // žádný enum na úrovni DB. Neškodí u trenéra/klienta (zůstává NULL).
    try { $pdo->exec("ALTER TABLE users ADD COLUMN diary_goal TEXT"); } catch (\Exception) {}

    $pdo->exec('PRAGMA user_version = 4');
    }

    if ($schemaVersion < 5) {
    // Čas tréninku od-do (HH:MM, stejný formát jako workouts.time) — ručně doplňovaný,
    // AI ho z přepisu nezkouší odhadovat.
    try { $pdo->exec("ALTER TABLE diary_entries ADD COLUMN start_time TEXT"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE diary_entries ADD COLUMN end_time TEXT"); } catch (\Exception) {}

    $pdo->exec('PRAGMA user_version = 5');
    }

    if ($schemaVersion < 6) {
    // Kardio (běh apod.) vedle silových cviků — exercise_type rozlišuje, jestli se u dané
    // "sady" čte reps/weight_kg (strength) nebo duration_min/distance_km (cardio). Volný text
    // jako u ostatních *_type/role sloupců, žádný DB enum.
    try { $pdo->exec("ALTER TABLE diary_sets ADD COLUMN exercise_type TEXT NOT NULL DEFAULT 'strength'"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE diary_sets ADD COLUMN duration_min REAL"); } catch (\Exception) {}
    try { $pdo->exec("ALTER TABLE diary_sets ADD COLUMN distance_km REAL"); } catch (\Exception) {}

    $pdo->exec('PRAGMA user_version = 6');
    }
}

function fetchOne(PDO $pdo, string $sql, array $params = []): ?array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function fetchAll(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function insertRow(PDO $pdo, string $table, array $data): int
{
    $cols = array_keys($data);
    $placeholders = implode(',', array_fill(0, count($cols), '?'));
    $colList = implode(',', array_map(fn($c) => "\"$c\"", $cols));
    $stmt = $pdo->prepare("INSERT INTO \"$table\" ($colList) VALUES ($placeholders)");
    $stmt->execute(array_values($data));
    return (int)$pdo->lastInsertId();
}

// Seedne demo trenéra a klienty s ukázkovými daty, aby šel POC hned předvést bez ručního
// zadávání. Idempotentní — spouští se jen když je tabulka users prázdná.
function seedDemoData(PDO $pdo, array $config): void
{
    if (!($config['seed_demo'] ?? true)) return;
    if ((int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn() > 0) return;

    $trainerId = insertRow($pdo, 'users', [
        'email' => 'tyylle@seznam.cz', 'role' => 'trainer', 'display_name' => 'David',
    ]);

    $client1 = insertRow($pdo, 'users', [
        'email' => 'petr@example.com', 'role' => 'client', 'display_name' => 'Petr Novák',
    ]);
    $client2 = insertRow($pdo, 'users', [
        'email' => 'jana@example.com', 'role' => 'client', 'display_name' => 'Jana Svobodová',
    ]);
    $client3 = insertRow($pdo, 'users', [
        'email' => 'tomas@example.com', 'role' => 'client', 'display_name' => 'Tomáš Dvořák',
    ]);

    $squat = insertRow($pdo, 'exercises', [
        'trainer_id' => $trainerId, 'name' => 'Dřep s činkou', 'muscle_group' => 'Nohy',
        'cues' => 'Záda rovná, kolena ve směru špiček, dřep pod paralelu. Nezvedej paty od země.',
        'video_url' => null,
    ]);
    $bench = insertRow($pdo, 'exercises', [
        'trainer_id' => $trainerId, 'name' => 'Bench press', 'muscle_group' => 'Hrudník',
        'cues' => 'Lopatky stažené k sobě, činka klesá k dolní části hrudníku, loket ne víc než 75° od těla.',
        'video_url' => null,
    ]);
    $deadlift = insertRow($pdo, 'exercises', [
        'trainer_id' => $trainerId, 'name' => 'Mrtvý tah', 'muscle_group' => 'Záda',
        'cues' => 'Činka blízko holení, záda rovná po celou dobu, zvedej přes paty, hýždě dozadu na spuštění.',
        'video_url' => null,
    ]);
    $ohp = insertRow($pdo, 'exercises', [
        'trainer_id' => $trainerId, 'name' => 'Tlak nad hlavu', 'muscle_group' => 'Ramena',
        'cues' => 'Jádro zpevněné, netlač do hyperextenze v zádech, činka jde přímo nad rameno.',
        'video_url' => null,
    ]);
    $row = insertRow($pdo, 'exercises', [
        'trainer_id' => $trainerId, 'name' => 'Veslování v předklonu', 'muscle_group' => 'Záda',
        'cues' => 'Předklon cca 45°, táhni loktem podél těla, lopatky na konci pohybu stáhnout k sobě.',
        'video_url' => null,
    ]);

    $today = date('Y-m-d');

    $workoutId = insertRow($pdo, 'workouts', [
        'client_id' => $client1, 'trainer_id' => $trainerId, 'date' => $today,
        'title' => 'Den A — Dolní polovina', 'notes' => 'Rozcvička 10 min kolo + mobilita kyčlí.', 'status' => 'planned',
    ]);
    insertRow($pdo, 'workout_exercises', [
        'workout_id' => $workoutId, 'exercise_id' => $squat, 'order' => 1,
        'target_sets' => 4, 'target_reps' => 6, 'target_weight_kg' => 80,
    ]);
    insertRow($pdo, 'workout_exercises', [
        'workout_id' => $workoutId, 'exercise_id' => $deadlift, 'order' => 2,
        'target_sets' => 3, 'target_reps' => 5, 'target_weight_kg' => 100,
    ]);

    $workout2 = insertRow($pdo, 'workouts', [
        'client_id' => $client1, 'trainer_id' => $trainerId, 'date' => date('Y-m-d', strtotime('+2 day')),
        'title' => 'Den B — Horní polovina', 'notes' => null, 'status' => 'planned',
    ]);
    insertRow($pdo, 'workout_exercises', [
        'workout_id' => $workout2, 'exercise_id' => $bench, 'order' => 1,
        'target_sets' => 4, 'target_reps' => 8, 'target_weight_kg' => 60,
    ]);
    insertRow($pdo, 'workout_exercises', [
        'workout_id' => $workout2, 'exercise_id' => $ohp, 'order' => 2,
        'target_sets' => 3, 'target_reps' => 8, 'target_weight_kg' => 35,
    ]);
    insertRow($pdo, 'workout_exercises', [
        'workout_id' => $workout2, 'exercise_id' => $row, 'order' => 3,
        'target_sets' => 3, 'target_reps' => 10, 'target_weight_kg' => 50,
    ]);

    insertRow($pdo, 'goals', [
        'client_id' => $client1, 'description' => 'Zvednout dřep na 100 kg', 'target_metric' => 'squat_1rm',
        'target_value' => 100, 'target_date' => date('Y-m-d', strtotime('+90 day')), 'status' => 'active',
    ]);

    insertRow($pdo, 'body_metrics', [
        'client_id' => $client1, 'date' => date('Y-m-d', strtotime('-14 day')),
        'weight_kg' => 82.4, 'waist_cm' => 88, 'chest_cm' => 102, 'hips_cm' => 98, 'arm_cm' => 36, 'thigh_cm' => 58,
    ]);
    insertRow($pdo, 'body_metrics', [
        'client_id' => $client1, 'date' => $today,
        'weight_kg' => 81.6, 'waist_cm' => 87, 'chest_cm' => 102, 'hips_cm' => 97, 'arm_cm' => 36.5, 'thigh_cm' => 58,
    ]);

    insertRow($pdo, 'nutrition_plans', [
        'client_id' => $client1, 'trainer_id' => $trainerId, 'title' => 'Fáze budování síly',
        'notes' => "Bílkoviny rozděl do 4 dávek přes den. Pij aspoň 3 l vody. Sacharidy hlavně kolem tréninku.",
        'daily_calories' => 2800, 'daily_protein_g' => 180, 'daily_carbs_g' => 320, 'daily_fat_g' => 80,
    ]);
}

// Doplní anglické varianty (name_en/muscle_group_en/cues_en) pro seedovaná demo cvičení
// (EN/CS přepínač jazyka, 2026-07-23). Nemůže jet přes seedDemoData(), protože ta na
// produkci od prvního nasazení nikdy znovu nespustí (gate na prázdné users) — místo toho
// idempotentní match podle českého názvu, bezpečné spouštět na každý request. Trenérovy
// vlastní cviky (bez shody) zůstávají name_en=NULL a zobrazí se v původním jazyce bez
// ohledu na toggle — to je záměrné, viz CLAUDE.md.
function backfillExerciseTranslations(PDO $pdo): void
{
    $translations = [
        'Dřep s činkou' => [
            'name_en' => 'Barbell Squat', 'muscle_group_en' => 'Legs',
            'cues_en' => "Keep your back straight, knees tracking over your toes, squat below parallel. Don't lift your heels off the floor.",
        ],
        'Bench press' => [
            'name_en' => 'Bench Press', 'muscle_group_en' => 'Chest',
            'cues_en' => 'Squeeze your shoulder blades together, lower the bar to the bottom of your chest, keep elbows no more than 75° from your body.',
        ],
        'Mrtvý tah' => [
            'name_en' => 'Deadlift', 'muscle_group_en' => 'Back',
            'cues_en' => 'Keep the bar close to your shins, back straight throughout, drive through your heels, hips back on the way down.',
        ],
        'Tlak nad hlavu' => [
            'name_en' => 'Overhead Press', 'muscle_group_en' => 'Shoulders',
            'cues_en' => 'Brace your core, avoid hyperextending your lower back, the bar travels straight up over your shoulder.',
        ],
        'Veslování v předklonu' => [
            'name_en' => 'Bent-Over Row', 'muscle_group_en' => 'Back',
            'cues_en' => 'Hinge forward to about 45°, pull with your elbow along your body, squeeze shoulder blades together at the top.',
        ],
    ];
    $stmt = $pdo->prepare("UPDATE exercises SET name_en=?, muscle_group_en=?, cues_en=? WHERE name=? AND name_en IS NULL");
    foreach ($translations as $csName => $en) {
        $stmt->execute([$en['name_en'], $en['muscle_group_en'], $en['cues_en'], $csName]);
    }
}

// Doplní tréninky/cíl/míry/výživu i pro klienty, kteří je ještě nemají (Jana, Tomáš) — na
// DB, kde seedDemoData() už jednou proběhla (produkce), se přes ni znovu nedostanou.
// Idempotentní per-klient: přeskočí každého, kdo už má aspoň jeden trénink.
function seedAdditionalClientData(PDO $pdo): void
{
    $trainer = fetchOne($pdo, "SELECT id FROM users WHERE role='trainer' LIMIT 1");
    if (!$trainer) return;
    $trainerId = (int)$trainer['id'];

    $exByName = [];
    foreach (fetchAll($pdo, "SELECT id, name FROM exercises WHERE trainer_id=?", [$trainerId]) as $e) {
        $exByName[$e['name']] = (int)$e['id'];
    }
    if (empty($exByName)) return;

    $today = date('Y-m-d');

    foreach (fetchAll($pdo, "SELECT id, display_name FROM users WHERE role='client'") as $c) {
        $clientId = (int)$c['id'];
        if (fetchOne($pdo, "SELECT id FROM workouts WHERE client_id=?", [$clientId])) continue;

        if ($c['display_name'] === 'Jana Svobodová') {
            $w1 = insertRow($pdo, 'workouts', [
                'client_id' => $clientId, 'trainer_id' => $trainerId, 'date' => $today,
                'title' => 'Dolní partie + core', 'notes' => 'Rozcvička 5 min + dynamický strečink.', 'status' => 'planned',
            ]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w1, 'exercise_id' => $exByName['Dřep s činkou'], 'order' => 1, 'target_sets' => 4, 'target_reps' => 12, 'target_weight_kg' => 40]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w1, 'exercise_id' => $exByName['Mrtvý tah'], 'order' => 2, 'target_sets' => 3, 'target_reps' => 10, 'target_weight_kg' => 50]);

            $w2 = insertRow($pdo, 'workouts', [
                'client_id' => $clientId, 'trainer_id' => $trainerId, 'date' => date('Y-m-d', strtotime('+2 day')),
                'title' => 'Horní partie', 'notes' => null, 'status' => 'planned',
            ]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w2, 'exercise_id' => $exByName['Bench press'], 'order' => 1, 'target_sets' => 3, 'target_reps' => 10, 'target_weight_kg' => 30]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w2, 'exercise_id' => $exByName['Veslování v předklonu'], 'order' => 2, 'target_sets' => 3, 'target_reps' => 12, 'target_weight_kg' => 25]);

            insertRow($pdo, 'goals', [
                'client_id' => $clientId, 'description' => 'Zhubnout 5 kg a zpevnit postavu', 'target_metric' => 'weight_kg',
                'target_value' => 63, 'target_date' => date('Y-m-d', strtotime('+120 day')), 'status' => 'active',
            ]);
            insertRow($pdo, 'body_metrics', ['client_id' => $clientId, 'date' => date('Y-m-d', strtotime('-14 day')), 'weight_kg' => 68.5, 'waist_cm' => 74, 'chest_cm' => 90, 'hips_cm' => 99, 'arm_cm' => 27, 'thigh_cm' => 56]);
            insertRow($pdo, 'body_metrics', ['client_id' => $clientId, 'date' => $today, 'weight_kg' => 67.8, 'waist_cm' => 73, 'chest_cm' => 90, 'hips_cm' => 98, 'arm_cm' => 27, 'thigh_cm' => 55.5]);
            insertRow($pdo, 'nutrition_plans', [
                'client_id' => $clientId, 'trainer_id' => $trainerId, 'title' => 'Fáze hubnutí',
                'notes' => 'Mírný kalorický deficit. Bílkoviny na každém jídle. Zelenina k obědu i večeři.',
                'daily_calories' => 1800, 'daily_protein_g' => 120, 'daily_carbs_g' => 160, 'daily_fat_g' => 55,
            ]);
        } elseif ($c['display_name'] === 'Tomáš Dvořák') {
            $w1 = insertRow($pdo, 'workouts', [
                'client_id' => $clientId, 'trainer_id' => $trainerId, 'date' => date('Y-m-d', strtotime('+1 day')),
                'title' => 'Celotělový trénink', 'notes' => 'Rozcvička 10 min + mobilita ramen.', 'status' => 'planned',
            ]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w1, 'exercise_id' => $exByName['Dřep s činkou'], 'order' => 1, 'target_sets' => 5, 'target_reps' => 5, 'target_weight_kg' => 100]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w1, 'exercise_id' => $exByName['Bench press'], 'order' => 2, 'target_sets' => 5, 'target_reps' => 5, 'target_weight_kg' => 85]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w1, 'exercise_id' => $exByName['Tlak nad hlavu'], 'order' => 3, 'target_sets' => 3, 'target_reps' => 8, 'target_weight_kg' => 45]);

            $w2 = insertRow($pdo, 'workouts', [
                'client_id' => $clientId, 'trainer_id' => $trainerId, 'date' => date('Y-m-d', strtotime('+3 day')),
                'title' => 'Záda a tah', 'notes' => null, 'status' => 'planned',
            ]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w2, 'exercise_id' => $exByName['Mrtvý tah'], 'order' => 1, 'target_sets' => 4, 'target_reps' => 5, 'target_weight_kg' => 140]);
            insertRow($pdo, 'workout_exercises', ['workout_id' => $w2, 'exercise_id' => $exByName['Veslování v předklonu'], 'order' => 2, 'target_sets' => 4, 'target_reps' => 10, 'target_weight_kg' => 60]);

            insertRow($pdo, 'goals', [
                'client_id' => $clientId, 'description' => 'Zvednout mrtvý tah na 160 kg', 'target_metric' => 'deadlift_1rm',
                'target_value' => 160, 'target_date' => date('Y-m-d', strtotime('+90 day')), 'status' => 'active',
            ]);
            insertRow($pdo, 'body_metrics', ['client_id' => $clientId, 'date' => date('Y-m-d', strtotime('-14 day')), 'weight_kg' => 91.2, 'waist_cm' => 94, 'chest_cm' => 108, 'hips_cm' => 104, 'arm_cm' => 39, 'thigh_cm' => 62]);
            insertRow($pdo, 'body_metrics', ['client_id' => $clientId, 'date' => $today, 'weight_kg' => 91.8, 'waist_cm' => 93, 'chest_cm' => 109, 'hips_cm' => 104, 'arm_cm' => 39.5, 'thigh_cm' => 62.5]);
            insertRow($pdo, 'nutrition_plans', [
                'client_id' => $clientId, 'trainer_id' => $trainerId, 'title' => 'Fáze nabírání síly',
                'notes' => 'Mírný kalorický přebytek. Zaměř se na kvalitní zdroje sacharidů kolem tréninku.',
                'daily_calories' => 3200, 'daily_protein_g' => 190, 'daily_carbs_g' => 380, 'daily_fat_g' => 90,
            ]);
        }
    }
}

// Doplňuje demo klientelu na názornější počet pro předvedení kalendáře (2026-07-24) —
// idempotentní podle e-mailu, bezpečné spouštět na každý request. Skuteční klienti, které
// David zadá sám, mají jiné e-maily, takže se s touhle sadou nikdy nepřekryjí.
function seedExtraDemoClients(PDO $pdo, array $config): void
{
    if (!($config['seed_demo'] ?? true)) return;
    $extraClients = [
        ['Lucie Horáková', 'lucie.horakova@example.com'],
        ['Martin Beneš', 'martin.benes@example.com'],
        ['Eva Procházková', 'eva.prochazkova@example.com'],
        ['Jakub Kučera', 'jakub.kucera@example.com'],
        ['Tereza Marešová', 'tereza.maresova@example.com'],
        ['Filip Sedláček', 'filip.sedlacek@example.com'],
        ['Kateřina Krejčí', 'katerina.krejci@example.com'],
        ['Ondřej Konečný', 'ondrej.konecny@example.com'],
        ['Barbora Machová', 'barbora.machova@example.com'],
        ['Michal Doležal', 'michal.dolezal@example.com'],
        ['Petra Bartošová', 'petra.bartosova@example.com'],
        ['Jan Poláček', 'jan.polacek@example.com'],
        ['Veronika Kadlecová', 'veronika.kadlecova@example.com'],
        ['Tomáš Vaněk', 'tomas.vanek@example.com'],
        ['Adéla Blažková', 'adela.blazkova@example.com'],
        ['Lukáš Kopecký', 'lukas.kopecky@example.com'],
        ['Nikola Šimková', 'nikola.simkova@example.com'],
        ['Radek Novotný', 'radek.novotny@example.com'],
        ['Simona Fialová', 'simona.fialova@example.com'],
        ['Zuzana Königová', 'zuzana.konigova@example.com'],
    ];
    foreach ($extraClients as [$name, $email]) {
        if (fetchOne($pdo, "SELECT id FROM users WHERE email=?", [$email])) continue;
        insertRow($pdo, 'users', ['email' => $email, 'role' => 'client', 'display_name' => $name]);
    }
}

// Doplní demo telefonní čísla pro seedovanou klientelu (trenér chce v přehledu klientů
// telefon místo e-mailu, 2026-07-24) — idempotentní podle e-mailu, nikdy nepřepíše telefon,
// který už klient/trenér zadal jinak.
function backfillDemoPhones(PDO $pdo): void
{
    $phones = [
        'petr@example.com' => '+420 601 000 001',
        'jana@example.com' => '+420 601 000 002',
        'tomas@example.com' => '+420 601 000 003',
        'lucie.horakova@example.com' => '+420 601 000 004',
        'martin.benes@example.com' => '+420 601 000 005',
        'eva.prochazkova@example.com' => '+420 601 000 006',
        'jakub.kucera@example.com' => '+420 601 000 007',
        'tereza.maresova@example.com' => '+420 601 000 008',
        'filip.sedlacek@example.com' => '+420 601 000 009',
        'katerina.krejci@example.com' => '+420 601 000 010',
        'ondrej.konecny@example.com' => '+420 601 000 011',
        'barbora.machova@example.com' => '+420 601 000 012',
        'michal.dolezal@example.com' => '+420 601 000 013',
        'petra.bartosova@example.com' => '+420 601 000 014',
        'jan.polacek@example.com' => '+420 601 000 015',
        'veronika.kadlecova@example.com' => '+420 601 000 016',
        'tomas.vanek@example.com' => '+420 601 000 017',
        'adela.blazkova@example.com' => '+420 601 000 018',
        'lukas.kopecky@example.com' => '+420 601 000 019',
        'nikola.simkova@example.com' => '+420 601 000 020',
        'radek.novotny@example.com' => '+420 601 000 021',
        'simona.fialova@example.com' => '+420 601 000 022',
        'zuzana.konigova@example.com' => '+420 601 000 023',
    ];
    $stmt = $pdo->prepare("UPDATE users SET phone=? WHERE email=? AND phone IS NULL");
    foreach ($phones as $email => $phone) {
        $stmt->execute([$phone, $email]);
    }
}

// Naplní červenec–srpen 2026 ukázkovým rozvrhem pro každého klienta, co v tomhle období
// ještě žádný trénink nemá — idempotentní per-klient (stejný vzor jako
// seedAdditionalClientData), takže to nikdy nepřepíše reálně zadané tréninky. Účel je čistě
// demo/vizuální (kalendář — denní zvýraznění proběhlo/probíhá/další, měsíční přehled časů),
// ne reálná tréninková data.
function seedJulyAugustDemoSchedule(PDO $pdo): void
{
    $trainer = fetchOne($pdo, "SELECT id FROM users WHERE role='trainer' LIMIT 1");
    if (!$trainer) return;
    $trainerId = (int)$trainer['id'];

    $titles = [
        'Nohy a záda', 'Horní polovina', 'Celotělový trénink', 'Push den', 'Pull den',
        'Dolní polovina', 'Síla — dřep a mrtvý tah', 'Kondice a core', 'Ramena a paže',
        'Regenerace a mobilita',
    ];
    // David má reálně pravidelný vzor: dopolední tréninky v celou hodinu, odpolední v :45
    // (stejná konvence jako výchozí minuta v TimeSelect.jsx — <12 → :00, >=12 → :45).
    $times = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:45', '13:45', '14:45', '15:45', '16:45', '17:45', '18:45', '19:45', '20:45'];
    $locations = [null, null, null, 'Posilovna Vinohrady', 'FF Anděl'];
    $today = date('Y-m-d');
    $nowTime = date('H:i');

    // Sdílená nabídka termínů (datum+čas+typ+místo) místo nezávislého losování za klienta —
    // když dva klienti "trefí" stejný termín, jde o skupinovou lekci se stejným typem
    // tréninku, ne o shodu času s different obsahem (viz kalendář — skupiny se stejným
    // časem se zobrazují jako jeden řádek přes všechny přihlášené klienty).
    $slots = [];
    for ($i = 0; $i < 40; $i++) {
        $dayOffset = random_int(0, 61);
        $slots[] = [
            'date' => date('Y-m-d', strtotime("2026-07-01 +{$dayOffset} days")),
            'time' => $times[array_rand($times)],
            'title' => $titles[array_rand($titles)],
            'location' => $locations[array_rand($locations)],
        ];
    }

    foreach (fetchAll($pdo, "SELECT id FROM users WHERE role='client'") as $c) {
        $clientId = (int)$c['id'];
        $already = fetchOne($pdo, "SELECT id FROM workouts WHERE client_id=? AND date >= '2026-07-01' AND date <= '2026-08-31'", [$clientId]);
        if ($already) continue;

        $sessionCount = random_int(5, 9);
        $usedSlots = [];
        for ($i = 0; $i < $sessionCount; $i++) {
            do { $slotIdx = random_int(0, count($slots) - 1); } while (in_array($slotIdx, $usedSlots, true));
            $usedSlots[] = $slotIdx;
            $slot = $slots[$slotIdx];
            $isPast = $slot['date'] < $today || ($slot['date'] === $today && $slot['time'] < $nowTime);
            $status = ($isPast && random_int(1, 100) <= 75) ? 'completed' : 'planned';
            insertRow($pdo, 'workouts', [
                'client_id' => $clientId, 'trainer_id' => $trainerId, 'date' => $slot['date'],
                'time' => $slot['time'], 'location' => $slot['location'],
                'title' => $slot['title'], 'notes' => null, 'status' => $status,
                'completed_at' => $status === 'completed' ? "{$slot['date']} {$slot['time']}:00" : null,
            ]);
        }
    }
}

// Demo data pro portálové rozšíření (equipment_options + content_sections/items) a přeznačení
// pár už seedovaných klientů na client_type='portal', ať je nová funkce od začátku vidět na
// test/produkci. Idempotentní podle name/title, stejný vzor jako seedExtraDemoClients.
function seedPortalDemoData(PDO $pdo): void
{
    $trainer = fetchOne($pdo, "SELECT id FROM users WHERE role='trainer' LIMIT 1");
    if (!$trainer) return;
    $trainerId = (int)$trainer['id'];

    $equipment = [
        ['FF Anděl', 'FF Anděl', 'gym'],
        ['Posilovna Vinohrady', 'Vinohrady Gym', 'gym'],
        ['Odporová guma', 'Resistance band', 'equipment'],
        ['Jednoručky', 'Dumbbells', 'equipment'],
        ['Kettlebell', 'Kettlebell', 'equipment'],
        ['Vlastní váha (bez vybavení)', 'Bodyweight only', 'equipment'],
    ];
    foreach ($equipment as [$name, $nameEn, $kind]) {
        if (fetchOne($pdo, "SELECT id FROM equipment_options WHERE trainer_id=? AND name=?", [$trainerId, $name])) continue;
        insertRow($pdo, 'equipment_options', ['trainer_id' => $trainerId, 'name' => $name, 'name_en' => $nameEn, 'kind' => $kind]);
    }

    $sections = [
        ['Video ukázky tréninku', 'Training style videos', [
            ['video', 'David — jak přistupuji k technice dřepu', 'David — my approach to squat technique', 'Krátké video o tom, na co se u dřepu zaměřuji.', 'Short video on what I focus on in the squat.', 'https://example.com/video/squat-technique'],
        ]],
        ['Strava', 'Nutrition', [
            ['article', 'Základy příjmu bílkovin', 'Protein intake basics', 'Obecný přehled, kolik bílkovin denně a proč.', 'General overview of daily protein intake and why.', null],
        ]],
        ['Playlisty', 'Playlists', [
            ['playlist', 'Playlist na sílu', 'Strength playlist', null, null, 'https://example.com/playlist/strength'],
        ]],
    ];
    foreach ($sections as [$title, $titleEn, $items]) {
        $section = fetchOne($pdo, "SELECT id FROM content_sections WHERE trainer_id=? AND title=?", [$trainerId, $title]);
        if (!$section) {
            $sectionId = insertRow($pdo, 'content_sections', ['trainer_id' => $trainerId, 'title' => $title, 'title_en' => $titleEn]);
        } else {
            $sectionId = (int)$section['id'];
        }
        foreach ($items as [$type, $itemTitle, $itemTitleEn, $body, $bodyEn, $url]) {
            if (fetchOne($pdo, "SELECT id FROM content_items WHERE section_id=? AND title=?", [$sectionId, $itemTitle])) continue;
            insertRow($pdo, 'content_items', [
                'section_id' => $sectionId, 'type' => $type, 'title' => $itemTitle, 'title_en' => $itemTitleEn,
                'body' => $body, 'body_en' => $bodyEn, 'url' => $url,
            ]);
        }
    }

    // Pár už seedovaných klientů přeznačit na portál, ať je segment od začátku demoovatelný.
    $portalEmails = ['lucie.horakova@example.com', 'martin.benes@example.com'];
    $stmt = $pdo->prepare("UPDATE users SET client_type='portal' WHERE email=?");
    foreach ($portalEmails as $email) {
        $stmt->execute([$email]);
    }
}

// Posilovny dřív žily jako equipment_options s kind='gym' (jeden společný zaškrtávací seznam
// pro všechny) — přesouvá se to do vlastní tabulky gyms, každá posilovna s vlastním seznamem
// vybavení (gym_equipment), protože různé posilovny mají různé vybavení. Stará equipment_options
// data pro 'gym' se po přesunu smažou (ON DELETE CASCADE smaže i případné client_equipment vazby
// na ně — ty dávaly smysl jen v tom starém, nahrazeném modelu).
function migrateGymsFromEquipmentOptions(PDO $pdo): void
{
    $trainer = fetchOne($pdo, "SELECT id FROM users WHERE role='trainer' LIMIT 1");
    if (!$trainer) return;
    $trainerId = (int)$trainer['id'];

    // Pár realističtějších kusů posilovnového vybavení do katalogu (dřív tam byly jen domácí
    // kusy) — ať mají nově vzniklé demo posilovny co reálně vybrat.
    $gymEquipment = [
        ['Kladkový trenažér', 'Cable machine'],
        ['Dřepovací stojan', 'Squat rack'],
        ['Benč', 'Bench press'],
    ];
    foreach ($gymEquipment as [$name, $nameEn]) {
        if (fetchOne($pdo, "SELECT id FROM equipment_options WHERE trainer_id=? AND name=?", [$trainerId, $name])) continue;
        insertRow($pdo, 'equipment_options', ['trainer_id' => $trainerId, 'name' => $name, 'name_en' => $nameEn, 'kind' => 'equipment']);
    }

    $oldGyms = fetchAll($pdo, "SELECT * FROM equipment_options WHERE trainer_id=? AND kind='gym'", [$trainerId]);
    foreach ($oldGyms as $old) {
        $existing = fetchOne($pdo, "SELECT id FROM gyms WHERE trainer_id=? AND name=?", [$trainerId, $old['name']]);
        if ($existing) {
            $gymId = (int)$existing['id'];
        } else {
            $gymId = insertRow($pdo, 'gyms', [
                'trainer_id' => $trainerId, 'name' => $old['name'], 'name_en' => $old['name_en'], 'active' => (int)$old['active'],
            ]);
            // Demo vybavení pro nově vzniklou posilovnu — dvě různé sady, ať je vidět, že se
            // posilovny mezi sebou liší, ne že mají všechny stejný katalog.
            $picks = $old['name'] === 'FF Anděl'
                ? ['Kladkový trenažér', 'Dřepovací stojan', 'Jednoručky']
                : ['Benč', 'Jednoručky', 'Kettlebell'];
            $items = fetchAll($pdo, "SELECT id FROM equipment_options WHERE trainer_id=? AND name IN ('" . implode("','", $picks) . "')", [$trainerId]);
            foreach ($items as $item) {
                try { insertRow($pdo, 'gym_equipment', ['gym_id' => $gymId, 'equipment_id' => (int)$item['id']]); } catch (\Exception) {}
            }
        }
        $pdo->prepare("DELETE FROM equipment_options WHERE id=?")->execute([(int)$old['id']]);
    }
}
