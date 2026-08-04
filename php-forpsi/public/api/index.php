<?php
declare(strict_types=1);
error_reporting(E_ALL);

$allowedOrigins = [
    'http://localhost:5310',
    'http://127.0.0.1:5310',
    'https://bloodandguts.cz',
    'https://www.bloodandguts.cz',
    'https://test.bloodandguts.cz',
    'https://muj.bloodandguts.cz',
];
$reqOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($reqOrigin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $reqOrigin);
}
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$_srcDir = defined('BG_LOCAL_SRC_DIR') ? BG_LOCAL_SRC_DIR : dirname(__DIR__) . '/src';
define('ERROR_LOG_FILE', dirname($_srcDir) . '/data/error.log');
require_once $_srcDir . '/bootstrap.php';
require_once $_srcDir . '/db.php';
require_once $_srcDir . '/ai.php';

$config = loadConfig();
$pdo    = db($config);

$rawUri = $_SERVER['REDIRECT_URL'] ?? $_SERVER['REQUEST_URI'] ?? '/';
$uri    = parse_url($rawUri, PHP_URL_PATH) ?? '/';
$path   = preg_replace('#^/api#', '', $uri) ?: '/';
$path   = rtrim($path, '/') ?: '/';
$seg    = explode('/', ltrim($path, '/'));
$method = $_SERVER['REQUEST_METHOD'];

function userPublic(array $u): array
{
    return [
        'id' => (int)$u['id'], 'email' => $u['email'], 'role' => $u['role'], 'display_name' => $u['display_name'],
        'diary_goal' => $u['diary_goal'] ?? null,
    ];
}

function tokenFor(array $config, array $u): string
{
    return jwt_create([
        'user_id' => (int)$u['id'], 'role' => $u['role'], 'name' => $u['display_name'],
        'exp' => time() + 60 * 60 * 24 * 30,
    ], $config['jwt_secret']);
}

// Zajistí, že klient patří přihlášenému trenérovi (nebo že jde o sebe sama, je-li klient).
function assertClientAccess(PDO $pdo, array $auth, int $clientId): void
{
    if ($auth['role'] === 'client') {
        if ($auth['user_id'] !== $clientId) jsonResponse(['detail' => 'Přístup zamítnut'], 403);
        return;
    }
    $client = fetchOne($pdo, "SELECT id FROM users WHERE id=? AND role='client'", [$clientId]);
    if (!$client) jsonResponse(['detail' => 'Klient nenalezen'], 404);
}

function notify(PDO $pdo, int $userId, string $type, string $body, ?string $link = null): void
{
    insertRow($pdo, 'notifications', ['user_id' => $userId, 'type' => $type, 'body' => $body, 'link' => $link]);
}

// Frontend nemá jedinou URL platnou pro obě role (trenér spravuje klienty pod
// /trainer/clients/{id}, klient má svoje vlastní /client/... routy) — odkaz v notifikaci se
// proto musí sestavit podle role příjemce, jinak vede na neexistující cestu a SPA fallback
// hodí uživatele na landing page (vypadá to jako neúmyslné odhlášení, i když token zůstává platný).
function notifyLink(string $recipientRole, int $clientId, ?int $workoutId = null): string
{
    if ($recipientRole === 'trainer') return "/trainer/clients/{$clientId}";
    return $workoutId ? "/client/workouts/{$workoutId}" : '/client/calendar';
}

// ── AUTH ──────────────────────────────────────────────────────────────

// Veřejný seznam osob pro POC login bez hesla (výběr role → výběr osoby). Role 'diary' je
// vyloučená záměrně — u veřejné self-registrace (viz POST /diary/register) by tenhle
// neautentizovaný seznam odhaloval cizí user_id, se kterým jde přihlásit bez hesla.
if ($method === 'GET' && $path === '/auth/people') {
    $rows = fetchAll($pdo, "SELECT id, role, display_name FROM users WHERE active=1 AND role IN ('trainer','client') ORDER BY role, display_name");
    jsonResponse($rows);
}

if ($method === 'POST' && $path === '/auth/demo-login') {
    $b = jsonInput();
    $userId = (int)($b['user_id'] ?? 0);
    $user = fetchOne($pdo, "SELECT * FROM users WHERE id=? AND active=1", [$userId]);
    if (!$user) jsonResponse(['detail' => 'Uživatel nenalezen'], 404);
    jsonResponse(['access_token' => tokenFor($config, $user), 'user' => userPublic($user)]);
}

if ($method === 'GET' && $path === '/me') {
    $auth = requireAuth($config);
    $user = fetchOne($pdo, "SELECT * FROM users WHERE id=?", [$auth['user_id']]);
    if (!$user) jsonResponse(['detail' => 'Uživatel nenalezen'], 404);
    jsonResponse(userPublic($user));
}

// ── POPTÁVKY (kontaktní formulář na landing page) ─────────────────────

if ($method === 'POST' && $path === '/inquiries') {
    $b = jsonInput();
    // Honeypot — skryté pole ve formuláři, které lidský návštěvník nikdy nevyplní.
    if (!empty($b['website'])) jsonResponse(['ok' => true]);

    $name    = trim((string)($b['name'] ?? ''));
    $email   = trim((string)($b['email'] ?? ''));
    $phone   = trim((string)($b['phone'] ?? ''));
    $message = trim((string)($b['message'] ?? ''));
    if ($name === '' || $message === '') jsonResponse(['detail' => 'Jméno a zpráva jsou povinné'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(['detail' => 'Neplatný e-mail'], 400);

    insertRow($pdo, 'inquiries', ['name' => $name, 'email' => $email, 'phone' => $phone ?: null, 'message' => $message]);
    jsonResponse(['ok' => true], 201);
}

if ($method === 'GET' && $path === '/inquiries') {
    requireRole($config, 'trainer');
    jsonResponse(fetchAll($pdo, "SELECT * FROM inquiries ORDER BY created_at DESC"));
}

// ── TRAINER: klienti ────────────────────────────────────────────────

// Adherence (dokončené/naplánované tréninky za posledních 28 dní) + poslední aktivita —
// sdíleno mezi GET /clients (přehled T3) a GET /clients/{id}/summary.
function clientSummary(PDO $pdo, int $clientId): array
{
    $since = date('Y-m-d', strtotime('-28 days'));
    $planned = (int)fetchOne($pdo, "SELECT COUNT(*) AS c FROM workouts WHERE client_id=? AND date >= ? AND date <= ?", [$clientId, $since, date('Y-m-d')])['c'];
    $completed = (int)fetchOne($pdo, "SELECT COUNT(*) AS c FROM workouts WHERE client_id=? AND status='completed' AND date >= ?", [$clientId, $since])['c'];
    $lastLog = fetchOne($pdo, "
        SELECT MAX(el.logged_at) AS t FROM exercise_logs el
        JOIN workout_exercises we ON we.id=el.workout_exercise_id JOIN workouts w ON w.id=we.workout_id
        WHERE w.client_id=?
    ", [$clientId]);
    return [
        'adherence_pct' => $planned > 0 ? (int)round($completed / $planned * 100) : null,
        'planned_count' => $planned,
        'completed_count' => $completed,
        'last_activity' => $lastLog['t'] ?? null,
    ];
}

// tier_id (odkaz na subscription_tiers) zrcadlí svůj název do volného textu tier —
// [tier_id, tier_name]. Bez tier_id se použije volný text z $b['tier'] beze změny (staré
// chování, zpětná kompatibilita).
function resolveTier(PDO $pdo, int $trainerId, array $b): array
{
    if (empty($b['tier_id'])) return [null, $b['tier'] ?? null];
    $tier = fetchOne($pdo, "SELECT name FROM subscription_tiers WHERE id=? AND trainer_id=?", [(int)$b['tier_id'], $trainerId]);
    if (!$tier) jsonResponse(['detail' => 'Tier nenalezen'], 404);
    return [(int)$b['tier_id'], $tier['name']];
}

if ($method === 'GET' && $path === '/clients') {
    $auth = requireRole($config, 'trainer');
    // current_price_kc/current_tier = nejnovější předplatné klienta — pro řazení Portál
    // klientů podle tieru od nejdražšího po nejlevnější na TrainerDashboard.jsx (žádné
    // pořadí tierů natvrdo v kódu, tier je volný text, price_kc je spolehlivější).
    // Dalších 5 sloupců (next_consultation_date .. last_plan_edit_at) jsou signály pro
    // Overview.jsx dashboard a řaditelnou tabulku na /trainer/clients — spočtené tady
    // jednou přes korelované subquery, ne per-klient smyčkou jako clientSummary().
    $sql = "SELECT id, email, phone, display_name, client_type, gym_id, created_at, (avatar_path IS NOT NULL) AS has_avatar,
        (SELECT price_kc FROM subscriptions WHERE client_id = users.id ORDER BY created_at DESC LIMIT 1) AS current_price_kc,
        (SELECT tier FROM subscriptions WHERE client_id = users.id ORDER BY created_at DESC LIMIT 1) AS current_tier,
        (SELECT tier_id FROM subscriptions WHERE client_id = users.id ORDER BY created_at DESC LIMIT 1) AS current_tier_id,
        (SELECT MIN(date) FROM workouts WHERE client_id = users.id AND date >= date('now') AND status != 'cancelled') AS next_consultation_date,
        (SELECT MAX(t) FROM (
            SELECT wc.created_at AS t FROM workout_comments wc JOIN workouts w2 ON w2.id = wc.workout_id WHERE w2.client_id = users.id AND wc.author_id = ?
            UNION ALL
            SELECT ec.created_at AS t FROM exercise_comments ec JOIN workout_exercises we2 ON we2.id = ec.workout_exercise_id JOIN workouts w3 ON w3.id = we2.workout_id WHERE w3.client_id = users.id AND ec.author_id = ?
        )) AS last_feedback_at,
        (SELECT MIN(date(period_month || '-01', 'start of month', '+1 month', '-1 day')) FROM challenges WHERE client_id = users.id AND status='active') AS challenge_end_date,
        (SELECT MAX(p.paid_at) FROM payments p JOIN subscriptions s ON s.id = p.subscription_id WHERE s.client_id = users.id) AS last_payment_at,
        (SELECT MAX(t) FROM (
            SELECT created_at AS t FROM goals WHERE client_id = users.id
            UNION ALL
            SELECT created_at AS t FROM body_metrics WHERE client_id = users.id
        )) AS last_progress_entry_at,
        (SELECT MAX(updated_at) FROM workouts WHERE client_id = users.id) AS last_plan_edit_at
        FROM users WHERE role='client' AND active=1";
    $params = [$auth['user_id'], $auth['user_id']];
    if (!empty($_GET['client_type'])) { $sql .= " AND client_type=?"; $params[] = $_GET['client_type']; }
    $sql .= " ORDER BY display_name";
    $clients = fetchAll($pdo, $sql, $params);
    foreach ($clients as &$c) { $c['summary'] = clientSummary($pdo, (int)$c['id']); }
    unset($c);
    jsonResponse($clients);
}

if ($method === 'GET' && count($seg) === 2 && $seg[0] === 'clients') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    $c = fetchOne($pdo, "SELECT id, email, phone, display_name, client_type, gym_id, (avatar_path IS NOT NULL) AS has_avatar FROM users WHERE id=? AND role='client'", [(int)$seg[1]]);
    if (!$c) jsonResponse(['detail' => 'Klient nenalezen'], 404);
    jsonResponse($c);
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'summary') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    jsonResponse(clientSummary($pdo, (int)$seg[1]));
}

// POST /clients — založení nového klienta (dřív neexistovalo vůbec, veškerá klientela vznikala
// jen ručním seedem v db.php). Bez hesla, stejný passwordless POC model jako zbytek appky
// (viz demo-login) — nový klient se hned objeví v /auth/people a jde se jím přihlásit.
if ($method === 'POST' && $path === '/clients') {
    requireRole($config, 'trainer');
    $b = jsonInput();
    $email = trim((string)($b['email'] ?? ''));
    $name = trim((string)($b['display_name'] ?? ''));
    if ($email === '' || $name === '') jsonResponse(['detail' => 'email a display_name jsou povinné'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(['detail' => 'Neplatný e-mail'], 400);
    if (fetchOne($pdo, "SELECT id FROM users WHERE email=?", [$email])) {
        jsonResponse(['detail' => 'Klient s tímto e-mailem už existuje'], 409);
    }
    $clientType = in_array($b['client_type'] ?? 'personal', ['personal', 'portal'], true) ? $b['client_type'] : 'personal';
    $id = insertRow($pdo, 'users', [
        'email' => $email, 'role' => 'client', 'display_name' => $name,
        'phone' => $b['phone'] ?? null, 'client_type' => $clientType,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT id, email, phone, display_name, client_type, created_at FROM users WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'clients') {
    requireRole($config, 'trainer');
    $existing = fetchOne($pdo, "SELECT * FROM users WHERE id=? AND role='client'", [(int)$seg[1]]);
    if (!$existing) jsonResponse(['detail' => 'Klient nenalezen'], 404);
    $b = jsonInput();
    $clientType = isset($b['client_type']) && in_array($b['client_type'], ['personal', 'portal'], true) ? $b['client_type'] : $existing['client_type'];
    // array_key_exists (ne ??) — klient/trenér musí umět gym_id výslovně vynulovat zpět na
    // "doma", null z JSONu by se jinak přes ?? tiše ignoroval a padl zpátky na starou hodnotu.
    $gymId = array_key_exists('gym_id', $b) ? ($b['gym_id'] !== null ? (int)$b['gym_id'] : null) : $existing['gym_id'];
    $pdo->prepare("UPDATE users SET display_name=?, phone=?, client_type=?, gym_id=? WHERE id=?")->execute([
        $b['display_name'] ?? $existing['display_name'], $b['phone'] ?? $existing['phone'], $clientType, $gymId, (int)$seg[1],
    ]);
    jsonResponse(fetchOne($pdo, "SELECT id, email, phone, display_name, client_type, gym_id, created_at FROM users WHERE id=?", [(int)$seg[1]]));
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'clients') {
    requireRole($config, 'trainer');
    $pdo->prepare("UPDATE users SET active=0 WHERE id=? AND role='client'")->execute([(int)$seg[1]]);
    jsonResponse(['ok' => true]);
}

// ── VYBAVENÍ / POSILOVNY (portál) — spravovaný seznam, hide-not-delete přes `active` ──

if ($method === 'GET' && $path === '/equipment-options') {
    $auth = requireAuth($config);
    // Jen jeden trenér v celé appce (David) — klient nemá vlastní trainer_id sloupec, takže
    // pro čtení stačí vzít jediného existujícího trenéra místo řešení víc-trenérského případu.
    if ($auth['role'] === 'trainer' && !empty($_GET['include_inactive'])) {
        jsonResponse(fetchAll($pdo, "SELECT * FROM equipment_options WHERE trainer_id=? ORDER BY kind, order_num, name", [$auth['user_id']]));
    }
    $trainer = fetchOne($pdo, "SELECT id FROM users WHERE role='trainer' LIMIT 1");
    $trainerId = $trainer ? (int)$trainer['id'] : 0;
    jsonResponse(fetchAll($pdo, "SELECT * FROM equipment_options WHERE trainer_id=? AND active=1 ORDER BY kind, order_num, name", [$trainerId]));
}

if ($method === 'POST' && $path === '/equipment-options') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $id = insertRow($pdo, 'equipment_options', [
        'trainer_id' => $auth['user_id'], 'name' => $b['name'], 'name_en' => $b['name_en'] ?? null,
        'kind' => $b['kind'] ?? 'equipment', 'order_num' => $b['order_num'] ?? 0,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM equipment_options WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'equipment-options') {
    requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT * FROM equipment_options WHERE id=?", [$id]);
    if (!$existing) jsonResponse(['detail' => 'Vybavení nenalezeno'], 404);
    $b = jsonInput();
    $pdo->prepare("UPDATE equipment_options SET name=?, name_en=?, kind=?, order_num=?, active=? WHERE id=?")->execute([
        $b['name'] ?? $existing['name'], $b['name_en'] ?? $existing['name_en'], $b['kind'] ?? $existing['kind'],
        $b['order_num'] ?? $existing['order_num'], isset($b['active']) ? (int)(bool)$b['active'] : $existing['active'], $id,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM equipment_options WHERE id=?", [$id]));
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'equipment') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    jsonResponse(fetchAll($pdo, "
        SELECT ce.id AS client_equipment_id, eo.*
        FROM client_equipment ce JOIN equipment_options eo ON eo.id = ce.equipment_id
        WHERE ce.client_id=? ORDER BY eo.kind, eo.order_num, eo.name
    ", [(int)$seg[1]]));
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'equipment') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    if (empty($b['equipment_id'])) jsonResponse(['detail' => 'equipment_id je povinné'], 400);
    try {
        insertRow($pdo, 'client_equipment', ['client_id' => (int)$seg[1], 'equipment_id' => (int)$b['equipment_id']]);
    } catch (\Exception) {} // UNIQUE(client_id, equipment_id) — už zaškrtnuto, no-op
    jsonResponse(['ok' => true], 201);
}

if ($method === 'DELETE' && count($seg) === 4 && $seg[0] === 'clients' && $seg[2] === 'equipment') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    $pdo->prepare("DELETE FROM client_equipment WHERE client_id=? AND equipment_id=?")->execute([(int)$seg[1], (int)$seg[3]]);
    jsonResponse(['ok' => true]);
}

// ── POSILOVNY (portál) — každá má vlastní seznam vybavení, hide-not-delete přes `active` ──

if ($method === 'GET' && $path === '/gyms') {
    $auth = requireAuth($config);
    if ($auth['role'] === 'trainer' && !empty($_GET['include_inactive'])) {
        jsonResponse(fetchAll($pdo, "SELECT * FROM gyms WHERE trainer_id=? ORDER BY name", [$auth['user_id']]));
    }
    $trainer = fetchOne($pdo, "SELECT id FROM users WHERE role='trainer' LIMIT 1");
    $trainerId = $trainer ? (int)$trainer['id'] : 0;
    jsonResponse(fetchAll($pdo, "SELECT * FROM gyms WHERE trainer_id=? AND active=1 ORDER BY name", [$trainerId]));
}

if ($method === 'POST' && $path === '/gyms') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $id = insertRow($pdo, 'gyms', [
        'trainer_id' => $auth['user_id'], 'name' => $b['name'], 'name_en' => $b['name_en'] ?? null,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM gyms WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'gyms') {
    requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT * FROM gyms WHERE id=?", [$id]);
    if (!$existing) jsonResponse(['detail' => 'Posilovna nenalezena'], 404);
    $b = jsonInput();
    $pdo->prepare("UPDATE gyms SET name=?, name_en=?, active=? WHERE id=?")->execute([
        $b['name'] ?? $existing['name'], $b['name_en'] ?? $existing['name_en'],
        isset($b['active']) ? (int)(bool)$b['active'] : $existing['active'], $id,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM gyms WHERE id=?", [$id]));
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'gyms' && $seg[2] === 'equipment') {
    requireAuth($config);
    jsonResponse(fetchAll($pdo, "
        SELECT ge.id AS gym_equipment_id, eo.*
        FROM gym_equipment ge JOIN equipment_options eo ON eo.id = ge.equipment_id
        WHERE ge.gym_id=? ORDER BY eo.order_num, eo.name
    ", [(int)$seg[1]]));
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'gyms' && $seg[2] === 'equipment') {
    requireRole($config, 'trainer');
    $gymId = (int)$seg[1];
    if (!fetchOne($pdo, "SELECT id FROM gyms WHERE id=?", [$gymId])) jsonResponse(['detail' => 'Posilovna nenalezena'], 404);
    $b = jsonInput();
    if (empty($b['equipment_id'])) jsonResponse(['detail' => 'equipment_id je povinné'], 400);
    try {
        insertRow($pdo, 'gym_equipment', ['gym_id' => $gymId, 'equipment_id' => (int)$b['equipment_id']]);
    } catch (\Exception) {} // UNIQUE(gym_id, equipment_id) — už přiřazeno, no-op
    jsonResponse(['ok' => true], 201);
}

if ($method === 'DELETE' && count($seg) === 4 && $seg[0] === 'gyms' && $seg[2] === 'equipment') {
    requireRole($config, 'trainer');
    $pdo->prepare("DELETE FROM gym_equipment WHERE gym_id=? AND equipment_id=?")->execute([(int)$seg[1], (int)$seg[3]]);
    jsonResponse(['ok' => true]);
}

// ── KLIENTEM VLASTNĚNÁ POSILOVNA — na rozdíl od gyms (Davidův katalog) si klient sám ────
// vloží odkaz na SVOJI posilovnu, David u ní nechává poznámky ke strojům (comments).

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'gym-link') {
    $auth = requireAuth($config);
    $clientId = (int)$seg[1];
    assertClientAccess($pdo, $auth, $clientId);
    jsonResponse(fetchOne($pdo, "SELECT * FROM client_gyms WHERE client_id=?", [$clientId]));
}

if ($method === 'PUT' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'gym-link') {
    $auth = requireAuth($config);
    $clientId = (int)$seg[1];
    assertClientAccess($pdo, $auth, $clientId);
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'Název posilovny je povinný'], 400);
    $existing = fetchOne($pdo, "SELECT * FROM client_gyms WHERE client_id=?", [$clientId]);
    if ($existing) {
        $pdo->prepare("UPDATE client_gyms SET name=?, url=?, updated_at=CURRENT_TIMESTAMP WHERE client_id=?")
            ->execute([$b['name'], $b['url'] ?? null, $clientId]);
    } else {
        insertRow($pdo, 'client_gyms', ['client_id' => $clientId, 'name' => $b['name'], 'url' => $b['url'] ?? null]);
    }
    jsonResponse(fetchOne($pdo, "SELECT * FROM client_gyms WHERE client_id=?", [$clientId]));
}

if ($method === 'GET' && count($seg) === 4 && $seg[0] === 'clients' && $seg[2] === 'gym-link' && $seg[3] === 'comments') {
    $auth = requireAuth($config);
    $clientId = (int)$seg[1];
    assertClientAccess($pdo, $auth, $clientId);
    $gym = fetchOne($pdo, "SELECT id FROM client_gyms WHERE client_id=?", [$clientId]);
    if (!$gym) jsonResponse([]);
    jsonResponse(fetchAll($pdo,
        "SELECT c.*, u.display_name AS author_name FROM client_gym_comments c JOIN users u ON u.id=c.author_id WHERE c.client_gym_id=? ORDER BY c.created_at",
        [(int)$gym['id']]
    ));
}

if ($method === 'POST' && count($seg) === 4 && $seg[0] === 'clients' && $seg[2] === 'gym-link' && $seg[3] === 'comments') {
    $auth = requireAuth($config);
    $clientId = (int)$seg[1];
    assertClientAccess($pdo, $auth, $clientId);
    $gym = fetchOne($pdo, "SELECT id FROM client_gyms WHERE client_id=?", [$clientId]);
    if (!$gym) jsonResponse(['detail' => 'Klient ještě nemá zadanou posilovnu'], 404);
    $b = jsonInput();
    $body = trim((string)($b['body'] ?? ''));
    if ($body === '') jsonResponse(['detail' => 'body je povinné'], 400);
    $id = insertRow($pdo, 'client_gym_comments', ['client_gym_id' => (int)$gym['id'], 'author_id' => $auth['user_id'], 'body' => $body]);
    $recipientRole = $auth['role'] === 'client' ? 'trainer' : 'client';
    $recipientId = $recipientRole === 'trainer'
        ? (int)fetchOne($pdo, "SELECT id FROM users WHERE role='trainer' LIMIT 1")['id']
        : $clientId;
    notify($pdo, $recipientId, 'comment', ($auth['name'] ?? 'Uživatel') . ' přidal(a) poznámku k posilovně',
        $recipientRole === 'trainer' ? "/trainer/clients/{$clientId}" : '/client/gym');
    jsonResponse(fetchOne($pdo, "SELECT c.*, u.display_name AS author_name FROM client_gym_comments c JOIN users u ON u.id=c.author_id WHERE c.id=?", [$id]), 201);
}

// ── KNIHOVNA OBSAHU (portál) — videa/strava/playlisty, viditelné všem klientům ──

if ($method === 'GET' && $path === '/content-sections') {
    $auth = requireAuth($config);
    $includeInactive = $auth['role'] === 'trainer' && !empty($_GET['include_inactive']);
    $sectionSql = "SELECT * FROM content_sections" . ($includeInactive ? "" : " WHERE active=1") . " ORDER BY order_num, id";
    $sections = fetchAll($pdo, $sectionSql);
    foreach ($sections as &$s) {
        $itemSql = "SELECT * FROM content_items WHERE section_id=?" . ($includeInactive ? "" : " AND active=1") . " ORDER BY order_num, id";
        $s['items'] = fetchAll($pdo, $itemSql, [(int)$s['id']]);
    }
    unset($s);
    jsonResponse($sections);
}

if ($method === 'POST' && $path === '/content-sections') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['title'])) jsonResponse(['detail' => 'title je povinné'], 400);
    $kind = in_array($b['kind'] ?? null, ['library', 'about_me'], true) ? $b['kind'] : 'library';
    $id = insertRow($pdo, 'content_sections', [
        'trainer_id' => $auth['user_id'], 'title' => $b['title'], 'title_en' => $b['title_en'] ?? null,
        'order_num' => $b['order_num'] ?? 0, 'kind' => $kind,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM content_sections WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'content-sections') {
    $auth = requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT * FROM content_sections WHERE id=? AND trainer_id=?", [$id, $auth['user_id']]);
    if (!$existing) jsonResponse(['detail' => 'Sekce nenalezena'], 404);
    $b = jsonInput();
    $kind = in_array($b['kind'] ?? null, ['library', 'about_me'], true) ? $b['kind'] : $existing['kind'];
    $pdo->prepare("UPDATE content_sections SET title=?, title_en=?, order_num=?, active=?, kind=? WHERE id=?")->execute([
        $b['title'] ?? $existing['title'], $b['title_en'] ?? $existing['title_en'],
        $b['order_num'] ?? $existing['order_num'], isset($b['active']) ? (int)(bool)$b['active'] : $existing['active'], $kind, $id,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM content_sections WHERE id=?", [$id]));
}

// Skutečné mazání (ne jen active=0) — na žádost uživatele 2026-08-02, po zjištění, že
// testovací "E2E Sekce ..." data se z trenérova pohledu nedala nikdy zbavit (hide-not-delete
// tu jen skrývalo klientům, trenér vidí i skryté). content_items.section_id má ON DELETE
// CASCADE, takže smazání sekce smaže i její položky.
if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'content-sections') {
    $auth = requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT id FROM content_sections WHERE id=? AND trainer_id=?", [$id, $auth['user_id']]);
    if (!$existing) jsonResponse(['detail' => 'Sekce nenalezena'], 404);
    $pdo->prepare("DELETE FROM content_sections WHERE id=?")->execute([$id]);
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'content-sections' && $seg[2] === 'items') {
    $auth = requireRole($config, 'trainer');
    $sectionId = (int)$seg[1];
    $section = fetchOne($pdo, "SELECT * FROM content_sections WHERE id=? AND trainer_id=?", [$sectionId, $auth['user_id']]);
    if (!$section) jsonResponse(['detail' => 'Sekce nenalezena'], 404);
    $b = jsonInput();
    if (empty($b['title'])) jsonResponse(['detail' => 'title je povinné'], 400);
    $id = insertRow($pdo, 'content_items', [
        'section_id' => $sectionId, 'type' => $b['type'] ?? 'video', 'title' => $b['title'], 'title_en' => $b['title_en'] ?? null,
        'body' => $b['body'] ?? null, 'body_en' => $b['body_en'] ?? null, 'url' => $b['url'] ?? null,
        'order_num' => $b['order_num'] ?? 0,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM content_items WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'content-items') {
    $auth = requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "
        SELECT ci.* FROM content_items ci JOIN content_sections cs ON cs.id = ci.section_id
        WHERE ci.id=? AND cs.trainer_id=?
    ", [$id, $auth['user_id']]);
    if (!$existing) jsonResponse(['detail' => 'Položka nenalezena'], 404);
    $b = jsonInput();
    $pdo->prepare("UPDATE content_items SET type=?, title=?, title_en=?, body=?, body_en=?, url=?, order_num=?, active=? WHERE id=?")->execute([
        $b['type'] ?? $existing['type'], $b['title'] ?? $existing['title'], $b['title_en'] ?? $existing['title_en'],
        $b['body'] ?? $existing['body'], $b['body_en'] ?? $existing['body_en'], $b['url'] ?? $existing['url'],
        $b['order_num'] ?? $existing['order_num'], isset($b['active']) ? (int)(bool)$b['active'] : $existing['active'], $id,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM content_items WHERE id=?", [$id]));
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'content-items') {
    $auth = requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "
        SELECT ci.id FROM content_items ci JOIN content_sections cs ON cs.id = ci.section_id
        WHERE ci.id=? AND cs.trainer_id=?
    ", [$id, $auth['user_id']]);
    if (!$existing) jsonResponse(['detail' => 'Položka nenalezena'], 404);
    $pdo->prepare("DELETE FROM content_items WHERE id=?")->execute([$id]);
    jsonResponse(['ok' => true]);
}

// ── CVIKY (knihovna trenéra) ────────────────────────────────────────

if ($method === 'GET' && $path === '/exercises') {
    requireAuth($config);
    jsonResponse(fetchAll($pdo, "SELECT * FROM exercises ORDER BY muscle_group, name"));
}

if ($method === 'POST' && $path === '/exercises') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $id = insertRow($pdo, 'exercises', [
        'trainer_id' => $auth['user_id'], 'name' => $b['name'],
        'muscle_group' => $b['muscle_group'] ?? null, 'category' => $b['category'] ?? null,
        'cues' => $b['cues'] ?? null, 'video_url' => $b['video_url'] ?? null,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM exercises WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'exercises') {
    requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT * FROM exercises WHERE id=?", [$id]);
    if (!$existing) jsonResponse(['detail' => 'Cvik nenalezen'], 404);
    $b = jsonInput();
    $pdo->prepare("UPDATE exercises SET name=?, muscle_group=?, category=?, cues=?, video_url=? WHERE id=?")->execute([
        $b['name'] ?? $existing['name'],
        $b['muscle_group'] ?? $existing['muscle_group'],
        $b['category'] ?? $existing['category'],
        $b['cues'] ?? $existing['cues'],
        $b['video_url'] ?? $existing['video_url'],
        $id,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM exercises WHERE id=?", [$id]));
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'exercises') {
    requireRole($config, 'trainer');
    $pdo->prepare("DELETE FROM exercises WHERE id=?")->execute([(int)$seg[1]]);
    jsonResponse(['ok' => true]);
}

// ── TRÉNINKY ─────────────────────────────────────────────────────────

// GET /schedule?from=&to= — trenérův rozvrh napříč všemi klienty (kdy, kde a s kým)
if ($method === 'GET' && $path === '/schedule') {
    $auth = requireRole($config, 'trainer');
    $sql = "SELECT w.*, u.display_name AS client_name, (u.avatar_path IS NOT NULL) AS client_has_avatar
            FROM workouts w JOIN users u ON u.id = w.client_id
            WHERE w.trainer_id=?";
    $params = [$auth['user_id']];
    if (!empty($_GET['from'])) { $sql .= " AND w.date >= ?"; $params[] = $_GET['from']; }
    if (!empty($_GET['to']))   { $sql .= " AND w.date <= ?"; $params[] = $_GET['to']; }
    $sql .= " ORDER BY w.date";
    jsonResponse(fetchAll($pdo, $sql, $params));
}

// GET /workouts?client_id=&from=&to=
if ($method === 'GET' && $path === '/workouts') {
    $auth = requireAuth($config);
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : ($auth['role'] === 'client' ? (int)$auth['user_id'] : null);
    if (!$clientId) jsonResponse(['detail' => 'client_id je povinné'], 400);
    assertClientAccess($pdo, $auth, $clientId);

    $sql = "SELECT * FROM workouts WHERE client_id=?";
    $params = [$clientId];
    if (!empty($_GET['from'])) { $sql .= " AND date >= ?"; $params[] = $_GET['from']; }
    if (!empty($_GET['to']))   { $sql .= " AND date <= ?"; $params[] = $_GET['to']; }
    $sql .= " ORDER BY date";
    jsonResponse(fetchAll($pdo, $sql, $params));
}

if ($method === 'POST' && $path === '/workouts') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    $clientId = (int)($b['client_id'] ?? 0);
    assertClientAccess($pdo, $auth, $clientId);
    if (empty($b['date']) || empty($b['title'])) jsonResponse(['detail' => 'date a title jsou povinné'], 400);
    $id = insertRow($pdo, 'workouts', [
        'client_id' => $clientId, 'trainer_id' => $auth['user_id'], 'date' => $b['date'],
        'time' => $b['time'] ?? null, 'location' => $b['location'] ?? null,
        'title' => $b['title'], 'notes' => $b['notes'] ?? null, 'status' => 'planned',
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [$id]), 201);
}

// PUT /workouts/{id} — úprava názvu/data/času/místa/poznámky
if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'workouts') {
    $auth = requireRole($config, 'trainer');
    $workoutId = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [$workoutId]);
    if (!$existing) jsonResponse(['detail' => 'Trénink nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$existing['client_id']);
    $b = jsonInput();
    $title = trim((string)($b['title'] ?? $existing['title']));
    if ($title === '') jsonResponse(['detail' => 'title je povinné'], 400);
    $pdo->prepare("UPDATE workouts SET title=?, date=?, time=?, location=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([
        $title, $b['date'] ?? $existing['date'], $b['time'] ?? $existing['time'],
        $b['location'] ?? $existing['location'], $b['notes'] ?? $existing['notes'], $workoutId,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [$workoutId]));
}

// GET /workouts/{id} — detail vč. cviků a zalogovaných sérií
if ($method === 'GET' && count($seg) === 2 && $seg[0] === 'workouts') {
    $auth = requireAuth($config);
    $workout = fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [(int)$seg[1]]);
    if (!$workout) jsonResponse(['detail' => 'Trénink nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$workout['client_id']);

    $exercises = fetchAll($pdo,
        "SELECT we.*, e.name, e.muscle_group, e.cues, e.video_url, e.name_en, e.muscle_group_en, e.cues_en
         FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
         WHERE we.workout_id=? ORDER BY we.\"order\"",
        [(int)$seg[1]]
    );
    foreach ($exercises as &$ex) {
        $ex['logs'] = fetchAll($pdo, "SELECT * FROM exercise_logs WHERE workout_exercise_id=? ORDER BY set_number", [(int)$ex['id']]);
    }
    unset($ex);
    $workout['exercises'] = $exercises;
    jsonResponse($workout);
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'workouts') {
    $auth = requireRole($config, 'trainer');
    $workout = fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [(int)$seg[1]]);
    if ($workout) assertClientAccess($pdo, $auth, (int)$workout['client_id']);
    $pdo->prepare("DELETE FROM workouts WHERE id=?")->execute([(int)$seg[1]]);
    jsonResponse(['ok' => true]);
}

// POST /workouts/{id}/exercises — přidat cvik do tréninku
if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'workouts' && $seg[2] === 'exercises') {
    $auth = requireRole($config, 'trainer');
    $workoutId = (int)$seg[1];
    $workout = fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [$workoutId]);
    if (!$workout) jsonResponse(['detail' => 'Trénink nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$workout['client_id']);
    $b = jsonInput();
    if (empty($b['exercise_id'])) jsonResponse(['detail' => 'exercise_id je povinné'], 400);
    $orderRow = fetchOne($pdo, "SELECT COALESCE(MAX(\"order\"),0) AS mx FROM workout_exercises WHERE workout_id=?", [$workoutId]);
    $id = insertRow($pdo, 'workout_exercises', [
        'workout_id' => $workoutId, 'exercise_id' => (int)$b['exercise_id'],
        'order' => (int)$orderRow['mx'] + 1,
        'target_sets' => $b['target_sets'] ?? null, 'target_reps' => $b['target_reps'] ?? null,
        'target_weight_kg' => $b['target_weight_kg'] ?? null, 'notes' => $b['notes'] ?? null,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM workout_exercises WHERE id=?", [$id]), 201);
}

// DELETE /workout-exercises/{id}
if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'workout-exercises') {
    requireRole($config, 'trainer');
    $pdo->prepare("DELETE FROM workout_exercises WHERE id=?")->execute([(int)$seg[1]]);
    jsonResponse(['ok' => true]);
}

// PUT /workout-exercises/{id} — trenérův komentář ke cviku (feedback k provedení)
if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'workout-exercises') {
    $auth = requireRole($config, 'trainer');
    $weId = (int)$seg[1];
    $we = fetchOne($pdo, "SELECT we.*, w.client_id FROM workout_exercises we JOIN workouts w ON w.id=we.workout_id WHERE we.id=?", [$weId]);
    if (!$we) jsonResponse(['detail' => 'Cvik v tréninku nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$we['client_id']);
    $b = jsonInput();
    $pdo->prepare("UPDATE workout_exercises SET notes=? WHERE id=?")->execute([$b['notes'] ?? null, $weId]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM workout_exercises WHERE id=?", [$weId]));
}

// POST /workout-exercises/{id}/logs — klient zapíše odcvičenou sérii (+ volitelný komentář proč)
if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'workout-exercises' && $seg[2] === 'logs') {
    $auth = requireAuth($config);
    $weId = (int)$seg[1];
    $we = fetchOne($pdo, "SELECT we.*, w.client_id FROM workout_exercises we JOIN workouts w ON w.id=we.workout_id WHERE we.id=?", [$weId]);
    if (!$we) jsonResponse(['detail' => 'Cvik v tréninku nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$we['client_id']);
    $b = jsonInput();
    // client_ref: klientem vygenerované UUID pro offline frontu — pokud dřívější pokus už
    // na serveru uspěl, ale odpověď se ke klientovi kvůli výpadku sítě nedostala, retry s
    // tímtéž client_ref vrátí existující záznam místo duplicitního zápisu série.
    $clientRef = $b['client_ref'] ?? null;
    if ($clientRef) {
        $existing = fetchOne($pdo, "SELECT * FROM exercise_logs WHERE client_ref=?", [$clientRef]);
        if ($existing) jsonResponse($existing, 201);
    }
    $setNumberRow = fetchOne($pdo, "SELECT COALESCE(MAX(set_number),0) AS mx FROM exercise_logs WHERE workout_exercise_id=?", [$weId]);
    $id = insertRow($pdo, 'exercise_logs', [
        'workout_exercise_id' => $weId, 'set_number' => (int)$setNumberRow['mx'] + 1,
        'actual_reps' => $b['actual_reps'] ?? null, 'actual_weight_kg' => $b['actual_weight_kg'] ?? null,
        'note' => $b['note'] ?? null, 'rpe' => $b['rpe'] ?? null, 'client_ref' => $clientRef,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM exercise_logs WHERE id=?", [$id]), 201);
}

// ── CÍLE ─────────────────────────────────────────────────────────────

if ($method === 'GET' && $path === '/goals') {
    $auth = requireAuth($config);
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : (int)$auth['user_id'];
    assertClientAccess($pdo, $auth, $clientId);
    jsonResponse(fetchAll($pdo, "SELECT * FROM goals WHERE client_id=? ORDER BY created_at DESC", [$clientId]));
}

if ($method === 'POST' && $path === '/goals') {
    $auth = requireAuth($config);
    $b = jsonInput();
    $clientId = (int)($b['client_id'] ?? $auth['user_id']);
    assertClientAccess($pdo, $auth, $clientId);
    if (empty($b['description'])) jsonResponse(['detail' => 'description je povinné'], 400);
    $id = insertRow($pdo, 'goals', [
        'client_id' => $clientId, 'description' => $b['description'],
        'target_metric' => $b['target_metric'] ?? null, 'target_value' => $b['target_value'] ?? null,
        'target_date' => $b['target_date'] ?? null, 'status' => 'active',
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM goals WHERE id=?", [$id]), 201);
}

// ── MĚSÍČNÍ VÝZVY ────────────────────────────────────────────────────
// status/completed_at smí měnit jen trenér, visibility_opt_in jen sám klient na svém
// řádku — dvě samostatné endpointy, ať jedna role omylem nepřepíše pole druhé.

if ($method === 'GET' && $path === '/challenges') {
    $auth = requireAuth($config);
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : (int)$auth['user_id'];
    assertClientAccess($pdo, $auth, $clientId);
    jsonResponse(fetchAll($pdo, "SELECT * FROM challenges WHERE client_id=? ORDER BY period_month DESC", [$clientId]));
}

// Veřejný (jen pro přihlášené) motivační feed — jediné místo v appce, kde je vidět kousek
// dat jednoho klienta druhému, a jen po jeho vlastním opt-inu. Záměrně bez assertClientAccess
// a záměrně jen tahle 3 pole — nikdy nerozšiřovat o join na subscriptions/body_metrics apod.
if ($method === 'GET' && $path === '/challenges/community') {
    requireAuth($config);
    jsonResponse(fetchAll($pdo, "
        SELECT c.description, c.completed_at, u.display_name
        FROM challenges c JOIN users u ON u.id=c.client_id
        WHERE c.status='completed' AND c.visibility_opt_in=1
        ORDER BY c.completed_at DESC LIMIT 20
    "));
}

if ($method === 'POST' && $path === '/challenges') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    $clientId = (int)($b['client_id'] ?? 0);
    assertClientAccess($pdo, $auth, $clientId);
    if (empty($b['description']) || empty($b['period_month'])) {
        jsonResponse(['detail' => 'description a period_month jsou povinné'], 400);
    }
    try {
        $id = insertRow($pdo, 'challenges', [
            'client_id' => $clientId, 'trainer_id' => $auth['user_id'], 'description' => $b['description'],
            'period_month' => $b['period_month'], 'reward_note' => $b['reward_note'] ?? null,
        ]);
    } catch (\Exception) {
        jsonResponse(['detail' => 'Tenhle klient už na daný měsíc výzvu má'], 409);
    }
    jsonResponse(fetchOne($pdo, "SELECT * FROM challenges WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 3 && $seg[0] === 'challenges' && $seg[2] === 'status') {
    $auth = requireRole($config, 'trainer');
    $challenge = fetchOne($pdo, "SELECT * FROM challenges WHERE id=?", [(int)$seg[1]]);
    if (!$challenge) jsonResponse(['detail' => 'Výzva nenalezena'], 404);
    $b = jsonInput();
    if (!in_array($b['status'] ?? null, ['active', 'completed', 'missed'], true)) {
        jsonResponse(['detail' => 'status musí být active|completed|missed'], 400);
    }
    $pdo->prepare("UPDATE challenges SET status=?, completed_at=? WHERE id=?")->execute([
        $b['status'], $b['status'] === 'completed' ? date('Y-m-d H:i:s') : null, (int)$seg[1],
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM challenges WHERE id=?", [(int)$seg[1]]));
}

if ($method === 'PUT' && count($seg) === 3 && $seg[0] === 'challenges' && $seg[2] === 'visibility') {
    $auth = requireAuth($config);
    $challenge = fetchOne($pdo, "SELECT * FROM challenges WHERE id=?", [(int)$seg[1]]);
    if (!$challenge) jsonResponse(['detail' => 'Výzva nenalezena'], 404);
    if ($auth['role'] !== 'client' || $auth['user_id'] !== (int)$challenge['client_id']) {
        jsonResponse(['detail' => 'Přístup zamítnut'], 403);
    }
    $b = jsonInput();
    $pdo->prepare("UPDATE challenges SET visibility_opt_in=? WHERE id=?")->execute([(int)(bool)($b['visibility_opt_in'] ?? false), (int)$seg[1]]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM challenges WHERE id=?", [(int)$seg[1]]));
}

// ── TĚLESNÉ MÍRY ─────────────────────────────────────────────────────

if ($method === 'GET' && $path === '/body-metrics') {
    $auth = requireAuth($config);
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : (int)$auth['user_id'];
    assertClientAccess($pdo, $auth, $clientId);
    jsonResponse(fetchAll($pdo, "SELECT * FROM body_metrics WHERE client_id=? ORDER BY date", [$clientId]));
}

if ($method === 'POST' && $path === '/body-metrics') {
    $auth = requireAuth($config);
    $b = jsonInput();
    $clientId = (int)($b['client_id'] ?? $auth['user_id']);
    assertClientAccess($pdo, $auth, $clientId);
    if (empty($b['date'])) jsonResponse(['detail' => 'date je povinné'], 400);
    $existing = fetchOne($pdo, "SELECT id FROM body_metrics WHERE client_id=? AND date=?", [$clientId, $b['date']]);
    $fields = [
        'weight_kg' => $b['weight_kg'] ?? null, 'waist_cm' => $b['waist_cm'] ?? null,
        'chest_cm' => $b['chest_cm'] ?? null, 'hips_cm' => $b['hips_cm'] ?? null,
        'arm_cm' => $b['arm_cm'] ?? null, 'thigh_cm' => $b['thigh_cm'] ?? null,
        'notes' => $b['notes'] ?? null,
    ];
    if ($existing) {
        $pdo->prepare("UPDATE body_metrics SET weight_kg=?, waist_cm=?, chest_cm=?, hips_cm=?, arm_cm=?, thigh_cm=?, notes=? WHERE id=?")
            ->execute([...array_values($fields), $existing['id']]);
        jsonResponse(fetchOne($pdo, "SELECT * FROM body_metrics WHERE id=?", [$existing['id']]));
    }
    $id = insertRow($pdo, 'body_metrics', ['client_id' => $clientId, 'date' => $b['date'], ...$fields]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM body_metrics WHERE id=?", [$id]), 201);
}

// ── VÝŽIVA ───────────────────────────────────────────────────────────

if ($method === 'GET' && $path === '/nutrition-plans') {
    $auth = requireAuth($config);
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : (int)$auth['user_id'];
    assertClientAccess($pdo, $auth, $clientId);
    jsonResponse(fetchAll($pdo, "SELECT * FROM nutrition_plans WHERE client_id=? ORDER BY updated_at DESC", [$clientId]));
}

if ($method === 'POST' && $path === '/nutrition-plans') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    $clientId = (int)($b['client_id'] ?? 0);
    assertClientAccess($pdo, $auth, $clientId);
    if (empty($b['title'])) jsonResponse(['detail' => 'title je povinné'], 400);
    $id = insertRow($pdo, 'nutrition_plans', [
        'client_id' => $clientId, 'trainer_id' => $auth['user_id'], 'title' => $b['title'],
        'notes' => $b['notes'] ?? null, 'daily_calories' => $b['daily_calories'] ?? null,
        'daily_protein_g' => $b['daily_protein_g'] ?? null, 'daily_carbs_g' => $b['daily_carbs_g'] ?? null,
        'daily_fat_g' => $b['daily_fat_g'] ?? null,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM nutrition_plans WHERE id=?", [$id]), 201);
}

// ── TÝMY (T7 skupinové/týmové programování) ────────────────────────────

function assertTeamOwnership(PDO $pdo, array $auth, int $teamId): array
{
    $team = fetchOne($pdo, "SELECT * FROM teams WHERE id=? AND trainer_id=?", [$teamId, $auth['user_id']]);
    if (!$team) jsonResponse(['detail' => 'Tým nenalezen'], 404);
    return $team;
}

if ($method === 'GET' && $path === '/teams') {
    $auth = requireRole($config, 'trainer');
    $teams = fetchAll($pdo, "SELECT * FROM teams WHERE trainer_id=? ORDER BY name", [$auth['user_id']]);
    foreach ($teams as &$t) {
        $t['members'] = fetchAll($pdo,
            "SELECT u.id, u.display_name FROM team_members tm JOIN users u ON u.id=tm.client_id WHERE tm.team_id=? ORDER BY u.display_name",
            [(int)$t['id']]
        );
    }
    unset($t);
    jsonResponse($teams);
}

if ($method === 'POST' && $path === '/teams') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $id = insertRow($pdo, 'teams', ['trainer_id' => $auth['user_id'], 'name' => $b['name']]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM teams WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'teams') {
    $auth = requireRole($config, 'trainer');
    assertTeamOwnership($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $pdo->prepare("UPDATE teams SET name=? WHERE id=?")->execute([$b['name'], (int)$seg[1]]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM teams WHERE id=?", [(int)$seg[1]]));
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'teams') {
    $auth = requireRole($config, 'trainer');
    assertTeamOwnership($pdo, $auth, (int)$seg[1]);
    $pdo->prepare("DELETE FROM teams WHERE id=?")->execute([(int)$seg[1]]);
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'teams' && $seg[2] === 'members') {
    $auth = requireRole($config, 'trainer');
    assertTeamOwnership($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    $clientId = (int)($b['client_id'] ?? 0);
    assertClientAccess($pdo, $auth, $clientId);
    try {
        insertRow($pdo, 'team_members', ['team_id' => (int)$seg[1], 'client_id' => $clientId]);
    } catch (\Exception) {}
    jsonResponse(['ok' => true], 201);
}

if ($method === 'DELETE' && count($seg) === 4 && $seg[0] === 'teams' && $seg[2] === 'members') {
    $auth = requireRole($config, 'trainer');
    assertTeamOwnership($pdo, $auth, (int)$seg[1]);
    $pdo->prepare("DELETE FROM team_members WHERE team_id=? AND client_id=?")->execute([(int)$seg[1], (int)$seg[3]]);
    jsonResponse(['ok' => true]);
}

// ── 1RM (T4 progrese, T7 týmové škálování, K3 graf) ────────────────────

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'one-rms') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    jsonResponse(fetchAll($pdo,
        "SELECT o.*, e.name AS exercise_name, e.name_en AS exercise_name_en FROM client_one_rms o JOIN exercises e ON e.id=o.exercise_id WHERE o.client_id=? ORDER BY o.recorded_at DESC",
        [(int)$seg[1]]
    ));
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'one-rms') {
    $auth = requireRole($config, 'trainer');
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    if (empty($b['exercise_id']) || empty($b['value_kg'])) jsonResponse(['detail' => 'exercise_id a value_kg jsou povinné'], 400);
    $id = insertRow($pdo, 'client_one_rms', [
        'client_id' => (int)$seg[1], 'exercise_id' => (int)$b['exercise_id'], 'value_kg' => (float)$b['value_kg'],
        'recorded_at' => $b['recorded_at'] ?? date('Y-m-d'),
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM client_one_rms WHERE id=?", [$id]), 201);
}

// ── REP-MAX (6/10 opakování) — David nechce ruční testování 1RM, jen powerlifteři testují ──
// singly; client_one_rms výš zůstává beze změny pro percent_1rm progresi, tohle je nový
// způsob zadávání pro trenéra/klienta (viz RepMaxTab).

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'rep-maxes') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    jsonResponse(fetchAll($pdo,
        "SELECT r.*, e.name AS exercise_name, e.name_en AS exercise_name_en FROM client_rep_maxes r JOIN exercises e ON e.id=r.exercise_id WHERE r.client_id=? ORDER BY r.recorded_at DESC",
        [(int)$seg[1]]
    ));
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'rep-maxes') {
    $auth = requireRole($config, 'trainer');
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    if (empty($b['exercise_id']) || empty($b['value_kg']) || !in_array((int)($b['rep_count'] ?? 0), [6, 10], true)) {
        jsonResponse(['detail' => 'exercise_id, value_kg a rep_count (6 nebo 10) jsou povinné'], 400);
    }
    $id = insertRow($pdo, 'client_rep_maxes', [
        'client_id' => (int)$seg[1], 'exercise_id' => (int)$b['exercise_id'], 'rep_count' => (int)$b['rep_count'],
        'value_kg' => (float)$b['value_kg'], 'recorded_at' => $b['recorded_at'] ?? date('Y-m-d'),
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM client_rep_maxes WHERE id=?", [$id]), 201);
}

// ── TRÉNINKOVÉ PLÁNY / BLOKY / MEZOCYKLY (T1, T4, T7) ──────────────────

function planTargetClientIds(PDO $pdo, array $plan): array
{
    if (!empty($plan['client_id'])) return [(int)$plan['client_id']];
    if (!empty($plan['team_id'])) {
        return array_map('intval', array_column(
            fetchAll($pdo, "SELECT client_id FROM team_members WHERE team_id=?", [(int)$plan['team_id']]), 'client_id'
        ));
    }
    return [];
}

function assertPlanOwnership(PDO $pdo, array $auth, int $planId): array
{
    $plan = fetchOne($pdo, "SELECT * FROM training_plans WHERE id=? AND trainer_id=?", [$planId, $auth['user_id']]);
    if (!$plan) jsonResponse(['detail' => 'Plán nenalezen'], 404);
    return $plan;
}

function assertBlockOwnership(PDO $pdo, array $auth, int $blockId): array
{
    $block = fetchOne($pdo, "
        SELECT pb.* FROM plan_blocks pb JOIN training_plans tp ON tp.id=pb.plan_id
        WHERE pb.id=? AND tp.trainer_id=?
    ", [$blockId, $auth['user_id']]);
    if (!$block) jsonResponse(['detail' => 'Blok nenalezen'], 404);
    return $block;
}

function planWithBlocks(PDO $pdo, array $plan): array
{
    $blocks = fetchAll($pdo, "SELECT * FROM plan_blocks WHERE plan_id=? ORDER BY order_num", [(int)$plan['id']]);
    foreach ($blocks as &$blk) {
        $blk['exercises'] = fetchAll($pdo,
            "SELECT be.*, e.name AS exercise_name, e.name_en AS exercise_name_en FROM block_exercises be JOIN exercises e ON e.id=be.exercise_id WHERE be.block_id=? ORDER BY be.day_of_week, be.\"order\"",
            [(int)$blk['id']]
        );
    }
    unset($blk);
    $plan['blocks'] = $blocks;
    return $plan;
}

if ($method === 'GET' && $path === '/training-plans') {
    $auth = requireAuth($config);
    if ($auth['role'] === 'trainer') {
        $plans = fetchAll($pdo, "SELECT * FROM training_plans WHERE trainer_id=? ORDER BY created_at DESC", [$auth['user_id']]);
    } else {
        $plans = fetchAll($pdo, "
            SELECT DISTINCT tp.* FROM training_plans tp
            LEFT JOIN team_members tm ON tm.team_id = tp.team_id
            WHERE tp.client_id = ? OR tm.client_id = ?
            ORDER BY tp.created_at DESC
        ", [$auth['user_id'], $auth['user_id']]);
    }
    jsonResponse($plans);
}

if ($method === 'POST' && $path === '/training-plans') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $clientId = !empty($b['client_id']) ? (int)$b['client_id'] : null;
    $teamId = !empty($b['team_id']) ? (int)$b['team_id'] : null;
    if ($clientId) assertClientAccess($pdo, $auth, $clientId);
    if ($teamId) assertTeamOwnership($pdo, $auth, $teamId);
    $id = insertRow($pdo, 'training_plans', [
        'trainer_id' => $auth['user_id'], 'team_id' => $teamId, 'client_id' => $clientId,
        'name' => $b['name'], 'description' => $b['description'] ?? null, 'status' => 'active',
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM training_plans WHERE id=?", [$id]), 201);
}

if ($method === 'GET' && count($seg) === 2 && $seg[0] === 'training-plans') {
    $auth = requireAuth($config);
    $plan = fetchOne($pdo, "SELECT * FROM training_plans WHERE id=?", [(int)$seg[1]]);
    if (!$plan) jsonResponse(['detail' => 'Plán nenalezen'], 404);
    if ($auth['role'] === 'client' && !in_array((int)$auth['user_id'], planTargetClientIds($pdo, $plan), true)) {
        jsonResponse(['detail' => 'Přístup zamítnut'], 403);
    }
    if ($auth['role'] === 'trainer' && (int)$plan['trainer_id'] !== (int)$auth['user_id']) {
        jsonResponse(['detail' => 'Přístup zamítnut'], 403);
    }
    jsonResponse(planWithBlocks($pdo, $plan));
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'training-plans') {
    $auth = requireRole($config, 'trainer');
    $plan = assertPlanOwnership($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    $pdo->prepare("UPDATE training_plans SET name=?, description=?, status=? WHERE id=?")->execute([
        $b['name'] ?? $plan['name'], $b['description'] ?? $plan['description'], $b['status'] ?? $plan['status'], (int)$seg[1],
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM training_plans WHERE id=?", [(int)$seg[1]]));
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'training-plans') {
    $auth = requireRole($config, 'trainer');
    assertPlanOwnership($pdo, $auth, (int)$seg[1]);
    $pdo->prepare("DELETE FROM training_plans WHERE id=?")->execute([(int)$seg[1]]);
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'training-plans' && $seg[2] === 'blocks') {
    $auth = requireRole($config, 'trainer');
    assertPlanOwnership($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $orderRow = fetchOne($pdo, "SELECT COALESCE(MAX(order_num),-1) AS mx FROM plan_blocks WHERE plan_id=?", [(int)$seg[1]]);
    $id = insertRow($pdo, 'plan_blocks', [
        'plan_id' => (int)$seg[1], 'name' => $b['name'], 'order_num' => (int)$orderRow['mx'] + 1,
        'weeks' => (int)($b['weeks'] ?? 4), 'days_per_week' => (int)($b['days_per_week'] ?? 3),
        'progression_type' => $b['progression_type'] ?? 'manual', 'target_rpe' => $b['target_rpe'] ?? null,
        'percent_1rm_start' => $b['percent_1rm_start'] ?? null, 'percent_1rm_end' => $b['percent_1rm_end'] ?? null,
        'start_date' => $b['start_date'] ?? date('Y-m-d'),
        'default_time' => $b['default_time'] ?? null, 'default_location' => $b['default_location'] ?? null,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM plan_blocks WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'plan-blocks') {
    $auth = requireRole($config, 'trainer');
    $block = assertBlockOwnership($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    $pdo->prepare("UPDATE plan_blocks SET name=?, weeks=?, days_per_week=?, progression_type=?, target_rpe=?, percent_1rm_start=?, percent_1rm_end=?, start_date=?, default_time=?, default_location=? WHERE id=?")->execute([
        $b['name'] ?? $block['name'], (int)($b['weeks'] ?? $block['weeks']), (int)($b['days_per_week'] ?? $block['days_per_week']),
        $b['progression_type'] ?? $block['progression_type'], $b['target_rpe'] ?? $block['target_rpe'],
        $b['percent_1rm_start'] ?? $block['percent_1rm_start'], $b['percent_1rm_end'] ?? $block['percent_1rm_end'],
        $b['start_date'] ?? $block['start_date'], $b['default_time'] ?? $block['default_time'],
        $b['default_location'] ?? $block['default_location'], (int)$seg[1],
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM plan_blocks WHERE id=?", [(int)$seg[1]]));
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'plan-blocks') {
    $auth = requireRole($config, 'trainer');
    assertBlockOwnership($pdo, $auth, (int)$seg[1]);
    $pdo->prepare("DELETE FROM plan_blocks WHERE id=?")->execute([(int)$seg[1]]);
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'plan-blocks' && $seg[2] === 'exercises') {
    $auth = requireRole($config, 'trainer');
    assertBlockOwnership($pdo, $auth, (int)$seg[1]);
    $b = jsonInput();
    if (empty($b['exercise_id'])) jsonResponse(['detail' => 'exercise_id je povinné'], 400);
    $id = insertRow($pdo, 'block_exercises', [
        'block_id' => (int)$seg[1], 'exercise_id' => (int)$b['exercise_id'],
        'day_of_week' => (int)($b['day_of_week'] ?? 1), 'order' => (int)($b['order'] ?? 0),
        'target_sets' => $b['target_sets'] ?? null, 'target_reps' => $b['target_reps'] ?? null,
        'notes' => $b['notes'] ?? null,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM block_exercises WHERE id=?", [$id]), 201);
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'block-exercises') {
    $auth = requireRole($config, 'trainer');
    $be = fetchOne($pdo, "
        SELECT be.* FROM block_exercises be
        JOIN plan_blocks pb ON pb.id=be.block_id JOIN training_plans tp ON tp.id=pb.plan_id
        WHERE be.id=? AND tp.trainer_id=?
    ", [(int)$seg[1], $auth['user_id']]);
    if ($be) $pdo->prepare("DELETE FROM block_exercises WHERE id=?")->execute([(int)$seg[1]]);
    jsonResponse(['ok' => true]);
}

// POST /plan-blocks/{id}/generate-workouts — T4 auto progrese + T7 týmové škálování: pro
// každého cílového klienta (přímo přiřazeného nebo člena týmu) vygeneruje konkrétní
// workouts/workout_exercises ze šablony bloku. U progression_type=percent_1rm dopočítá váhu
// z klientova posledního zaznamenaného 1RM (lineární interpolace % mezi start/end napříč
// týdny bloku, zaokrouhleno na 2.5 kg); u rpe nechá váhu na klientovi a nastaví jen cíl RPE.
if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'plan-blocks' && $seg[2] === 'generate-workouts') {
    $auth = requireRole($config, 'trainer');
    $block = assertBlockOwnership($pdo, $auth, (int)$seg[1]);
    $plan = fetchOne($pdo, "SELECT * FROM training_plans WHERE id=?", [(int)$block['plan_id']]);
    $clientIds = planTargetClientIds($pdo, $plan);
    if (empty($clientIds)) jsonResponse(['detail' => 'Plán nemá přiřazeného klienta ani tým'], 400);

    $exercises = fetchAll($pdo, "SELECT * FROM block_exercises WHERE block_id=? ORDER BY day_of_week, \"order\"", [(int)$block['id']]);
    if (empty($exercises)) jsonResponse(['detail' => 'Blok nemá žádné cviky'], 400);

    $byDay = [];
    foreach ($exercises as $ex) { $byDay[(int)$ex['day_of_week']][] = $ex; }

    $weeks = max(1, (int)$block['weeks']);
    $startDate = new DateTime($block['start_date'] ?: date('Y-m-d'));
    $created = 0;

    foreach ($clientIds as $clientId) {
        $oneRms = [];
        foreach (fetchAll($pdo, "SELECT exercise_id, value_kg FROM client_one_rms WHERE client_id=? ORDER BY recorded_at DESC", [$clientId]) as $r) {
            $exId = (int)$r['exercise_id'];
            if (!isset($oneRms[$exId])) $oneRms[$exId] = (float)$r['value_kg'];
        }

        for ($week = 0; $week < $weeks; $week++) {
            $pct = $weeks > 1
                ? (float)$block['percent_1rm_start'] + ((float)$block['percent_1rm_end'] - (float)$block['percent_1rm_start']) * ($week / ($weeks - 1))
                : (float)$block['percent_1rm_start'];

            foreach ($byDay as $dayOfWeek => $dayExercises) {
                $date = (clone $startDate)->modify('+' . ($week * 7 + ($dayOfWeek - 1)) . ' days')->format('Y-m-d');
                $workoutId = insertRow($pdo, 'workouts', [
                    'client_id' => $clientId, 'trainer_id' => $auth['user_id'], 'date' => $date,
                    'time' => $block['default_time'], 'location' => $block['default_location'],
                    'title' => $block['name'] . ' — týden ' . ($week + 1), 'notes' => null, 'status' => 'planned',
                ]);
                foreach ($dayExercises as $ex) {
                    $targetWeight = null;
                    $targetRpe = null;
                    if ($block['progression_type'] === 'percent_1rm' && isset($oneRms[(int)$ex['exercise_id']])) {
                        $targetWeight = round($oneRms[(int)$ex['exercise_id']] * $pct / 100 / 2.5) * 2.5;
                    } elseif ($block['progression_type'] === 'rpe') {
                        $targetRpe = $block['target_rpe'];
                    }
                    insertRow($pdo, 'workout_exercises', [
                        'workout_id' => $workoutId, 'exercise_id' => (int)$ex['exercise_id'],
                        'order' => (int)$ex['order'], 'target_sets' => $ex['target_sets'], 'target_reps' => $ex['target_reps'],
                        'target_weight_kg' => $targetWeight, 'target_rpe' => $targetRpe, 'notes' => $ex['notes'],
                    ]);
                }
                $created++;
            }
        }
        notify($pdo, $clientId, 'plan_generated', 'Trenér ti vygeneroval nové tréninky v plánu „' . $plan['name'] . '“', '/client/calendar');
    }

    jsonResponse(['ok' => true, 'workouts_created' => $created]);
}

// ── KOMENTÁŘE (S3 vázané na konkrétní položku, T5 zpětná vazba k technice) ──

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'workout-exercises' && $seg[2] === 'comments') {
    $auth = requireAuth($config);
    $we = fetchOne($pdo, "SELECT we.*, w.client_id FROM workout_exercises we JOIN workouts w ON w.id=we.workout_id WHERE we.id=?", [(int)$seg[1]]);
    if (!$we) jsonResponse(['detail' => 'Cvik v tréninku nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$we['client_id']);
    jsonResponse(fetchAll($pdo,
        "SELECT c.*, u.display_name AS author_name FROM exercise_comments c JOIN users u ON u.id=c.author_id WHERE c.workout_exercise_id=? ORDER BY c.created_at",
        [(int)$seg[1]]
    ));
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'workout-exercises' && $seg[2] === 'comments') {
    $auth = requireAuth($config);
    $we = fetchOne($pdo, "SELECT we.*, w.client_id, w.trainer_id FROM workout_exercises we JOIN workouts w ON w.id=we.workout_id WHERE we.id=?", [(int)$seg[1]]);
    if (!$we) jsonResponse(['detail' => 'Cvik v tréninku nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$we['client_id']);
    $b = jsonInput();
    $body = trim((string)($b['body'] ?? ''));
    if ($body === '') jsonResponse(['detail' => 'body je povinné'], 400);
    $id = insertRow($pdo, 'exercise_comments', [
        'workout_exercise_id' => (int)$seg[1], 'author_id' => $auth['user_id'], 'body' => $body,
        'video_timestamp_sec' => $b['video_timestamp_sec'] ?? null,
    ]);
    $recipientRole = $auth['role'] === 'client' ? 'trainer' : 'client';
    $recipientId = $recipientRole === 'trainer' ? (int)$we['trainer_id'] : (int)$we['client_id'];
    notify($pdo, $recipientId, 'comment', ($auth['name'] ?? 'Uživatel') . ' přidal(a) komentář ke cviku',
        notifyLink($recipientRole, (int)$we['client_id'], (int)$we['workout_id']));
    jsonResponse(fetchOne($pdo, "SELECT c.*, u.display_name AS author_name FROM exercise_comments c JOIN users u ON u.id=c.author_id WHERE c.id=?", [$id]), 201);
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'workouts' && $seg[2] === 'comments') {
    $auth = requireAuth($config);
    $workout = fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [(int)$seg[1]]);
    if (!$workout) jsonResponse(['detail' => 'Trénink nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$workout['client_id']);
    jsonResponse(fetchAll($pdo,
        "SELECT c.*, u.display_name AS author_name FROM workout_comments c JOIN users u ON u.id=c.author_id WHERE c.workout_id=? ORDER BY c.created_at",
        [(int)$seg[1]]
    ));
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'workouts' && $seg[2] === 'comments') {
    $auth = requireAuth($config);
    $workout = fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [(int)$seg[1]]);
    if (!$workout) jsonResponse(['detail' => 'Trénink nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$workout['client_id']);
    $b = jsonInput();
    $body = trim((string)($b['body'] ?? ''));
    if ($body === '') jsonResponse(['detail' => 'body je povinné'], 400);
    $id = insertRow($pdo, 'workout_comments', ['workout_id' => (int)$seg[1], 'author_id' => $auth['user_id'], 'body' => $body]);
    $recipientRole = $auth['role'] === 'client' ? 'trainer' : 'client';
    $recipientId = $recipientRole === 'trainer' ? (int)$workout['trainer_id'] : (int)$workout['client_id'];
    notify($pdo, $recipientId, 'comment', ($auth['name'] ?? 'Uživatel') . ' přidal(a) komentář k tréninku',
        notifyLink($recipientRole, (int)$workout['client_id'], (int)$seg[1]));
    jsonResponse(fetchOne($pdo, "SELECT c.*, u.display_name AS author_name FROM workout_comments c JOIN users u ON u.id=c.author_id WHERE c.id=?", [$id]), 201);
}

// ── DOKONČENÍ TRÉNINKU (K1, T3 adherence, S2 notifikace) ───────────────

if ($method === 'PATCH' && count($seg) === 3 && $seg[0] === 'workouts' && $seg[2] === 'complete') {
    $auth = requireAuth($config);
    $workout = fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [(int)$seg[1]]);
    if (!$workout) jsonResponse(['detail' => 'Trénink nenalezen'], 404);
    assertClientAccess($pdo, $auth, (int)$workout['client_id']);
    $pdo->prepare("UPDATE workouts SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=?")->execute([(int)$seg[1]]);
    notify($pdo, (int)$workout['trainer_id'], 'workout_completed',
        ($auth['name'] ?? 'Klient') . ' dokončil(a) trénink „' . $workout['title'] . '“', '/trainer/clients/' . $workout['client_id']);
    jsonResponse(fetchOne($pdo, "SELECT * FROM workouts WHERE id=?", [(int)$seg[1]]));
}

// ── ZPRÁVY (K5 chat s trenérem) ─────────────────────────────────────────

function otherPartyIds(PDO $pdo, array $auth): array
{
    if ($auth['role'] === 'trainer') {
        return array_map('intval', array_column(fetchAll($pdo, "SELECT id FROM users WHERE role='client' AND active=1"), 'id'));
    }
    return array_map('intval', array_column(fetchAll($pdo, "SELECT id FROM users WHERE role='trainer' AND active=1"), 'id'));
}

if ($method === 'GET' && $path === '/messages/threads') {
    $auth = requireRole($config, 'trainer');
    jsonResponse(fetchAll($pdo, "
        SELECT u.id AS client_id, u.display_name,
               (SELECT body FROM messages m WHERE (m.sender_id=u.id AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message,
               (SELECT COUNT(*) FROM messages m WHERE m.sender_id=u.id AND m.recipient_id=? AND m.read_at IS NULL) AS unread_count
        FROM users u WHERE u.role='client' AND u.active=1 ORDER BY u.display_name
    ", [$auth['user_id'], $auth['user_id'], $auth['user_id']]));
}

if ($method === 'GET' && $path === '/messages/unread-count') {
    $auth = requireAuth($config);
    $row = fetchOne($pdo, "SELECT COUNT(*) AS c FROM messages WHERE recipient_id=? AND read_at IS NULL", [$auth['user_id']]);
    jsonResponse(['count' => (int)$row['c']]);
}

if ($method === 'GET' && $path === '/messages') {
    $auth = requireAuth($config);
    $withId = (int)($_GET['with'] ?? 0);
    if (!$withId || !in_array($withId, otherPartyIds($pdo, $auth), true)) {
        jsonResponse(['detail' => 'with je povinné a musí být platný protějšek'], 400);
    }
    $rows = fetchAll($pdo,
        "SELECT * FROM messages WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?) ORDER BY created_at",
        [$auth['user_id'], $withId, $withId, $auth['user_id']]
    );
    $pdo->prepare("UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE recipient_id=? AND sender_id=? AND read_at IS NULL")
        ->execute([$auth['user_id'], $withId]);
    jsonResponse($rows);
}

if ($method === 'POST' && $path === '/messages') {
    $auth = requireAuth($config);
    $b = jsonInput();
    $recipientId = (int)($b['recipient_id'] ?? 0);
    if (!$recipientId || !in_array($recipientId, otherPartyIds($pdo, $auth), true)) {
        jsonResponse(['detail' => 'recipient_id neplatný'], 400);
    }
    $body = trim((string)($b['body'] ?? ''));
    if ($body === '') jsonResponse(['detail' => 'body je povinné'], 400);
    $id = insertRow($pdo, 'messages', ['sender_id' => $auth['user_id'], 'recipient_id' => $recipientId, 'body' => $body]);
    // Trenér řeší zprávy uvnitř detailu klienta (žádná samostatná /messages route pro trenéra
    // neexistuje) — odkaz proto podle role příjemce vede buď tam, nebo na klientovu vlastní stránku.
    $messageLink = $auth['role'] === 'client' ? "/trainer/clients/{$auth['user_id']}?tab=messages" : '/client/messages';
    notify($pdo, $recipientId, 'message', ($auth['name'] ?? 'Uživatel') . ' ti napsal(a) zprávu', $messageLink);
    jsonResponse(fetchOne($pdo, "SELECT * FROM messages WHERE id=?", [$id]), 201);
}

// ── NOTIFIKACE (S2 obousměrné notifikace) ───────────────────────────────

if ($method === 'GET' && $path === '/notifications') {
    $auth = requireAuth($config);
    jsonResponse(fetchAll($pdo, "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50", [$auth['user_id']]));
}

if ($method === 'GET' && $path === '/notifications/unread-count') {
    $auth = requireAuth($config);
    $row = fetchOne($pdo, "SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND read_at IS NULL", [$auth['user_id']]);
    jsonResponse(['count' => (int)$row['c']]);
}

if ($method === 'POST' && $path === '/notifications/read-all') {
    $auth = requireAuth($config);
    $pdo->prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL")->execute([$auth['user_id']]);
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'notifications' && $seg[2] === 'read') {
    $auth = requireAuth($config);
    $pdo->prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?")->execute([(int)$seg[1], $auth['user_id']]);
    jsonResponse(['ok' => true]);
}

// ── PROFILOVÁ FOTKA (avatar) — zobrazuje se trenérovi u tréninku v kalendáři ────

function assertAvatarWriteAccess(PDO $pdo, array $auth, int $userId): void
{
    if ((int)$auth['user_id'] === $userId) return; // kdokoliv si smí nastavit vlastní fotku
    if ($auth['role'] === 'trainer') { assertClientAccess($pdo, $auth, $userId); return; }
    jsonResponse(['detail' => 'Přístup zamítnut'], 403);
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'users' && $seg[2] === 'avatar') {
    $auth = requireAuth($config);
    $userId = (int)$seg[1];
    assertAvatarWriteAccess($pdo, $auth, $userId);
    if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['detail' => 'photo je povinné'], 400);
    }
    $target = fetchOne($pdo, "SELECT * FROM users WHERE id=?", [$userId]);
    if (!$target) jsonResponse(['detail' => 'Uživatel nenalezen'], 404);
    $ext = strtolower(pathinfo((string)$_FILES['photo']['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) jsonResponse(['detail' => 'Nepodporovaný formát obrázku'], 400);
    $dir = dirname($config['db_path']) . '/uploads/avatars';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    if ($target['avatar_path']) @unlink($dir . '/' . $target['avatar_path']);
    $filename = 'u' . $userId . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
    move_uploaded_file($_FILES['photo']['tmp_name'], $dir . '/' . $filename);
    $pdo->prepare("UPDATE users SET avatar_path=? WHERE id=?")->execute([$filename, $userId]);
    jsonResponse(['ok' => true, 'avatar_path' => $filename]);
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'users' && $seg[2] === 'avatar') {
    $auth = requireAuth($config);
    $userId = (int)$seg[1];
    $target = fetchOne($pdo, "SELECT * FROM users WHERE id=?", [$userId]);
    if (!$target || !$target['avatar_path']) jsonResponse(['detail' => 'Fotka nenalezena'], 404);
    // Trenér vidí fotky všech svých klientů, klient svou vlastní i trenérovu (pro chat).
    $allowed = (int)$auth['user_id'] === $userId || $auth['role'] === 'trainer' || $target['role'] === 'trainer';
    if (!$allowed) jsonResponse(['detail' => 'Přístup zamítnut'], 403);
    $fullPath = dirname($config['db_path']) . '/uploads/avatars/' . $target['avatar_path'];
    if (!is_file($fullPath)) jsonResponse(['detail' => 'Soubor nenalezen'], 404);
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    $mime = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=3600');
    readfile($fullPath);
    exit;
}

if ($method === 'DELETE' && count($seg) === 3 && $seg[0] === 'users' && $seg[2] === 'avatar') {
    $auth = requireAuth($config);
    $userId = (int)$seg[1];
    assertAvatarWriteAccess($pdo, $auth, $userId);
    $target = fetchOne($pdo, "SELECT * FROM users WHERE id=?", [$userId]);
    if ($target && $target['avatar_path']) {
        @unlink(dirname($config['db_path']) . '/uploads/avatars/' . $target['avatar_path']);
        $pdo->prepare("UPDATE users SET avatar_path=NULL WHERE id=?")->execute([$userId]);
    }
    jsonResponse(['ok' => true]);
}

// ── FOTKY POKROKU (K6) ───────────────────────────────────────────────

if ($method === 'POST' && $path === '/progress-photos') {
    $auth = requireAuth($config);
    $clientId = isset($_POST['client_id']) ? (int)$_POST['client_id'] : (int)$auth['user_id'];
    assertClientAccess($pdo, $auth, $clientId);
    if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['detail' => 'photo je povinné'], 400);
    }
    $ext = strtolower(pathinfo((string)$_FILES['photo']['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) jsonResponse(['detail' => 'Nepodporovaný formát obrázku'], 400);
    $dir = dirname($config['db_path']) . '/uploads/' . $clientId;
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    move_uploaded_file($_FILES['photo']['tmp_name'], $dir . '/' . $filename);
    $id = insertRow($pdo, 'progress_photos', [
        'client_id' => $clientId, 'date' => trim((string)($_POST['date'] ?? date('Y-m-d'))),
        'file_path' => $clientId . '/' . $filename, 'note' => $_POST['note'] ?? null,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM progress_photos WHERE id=?", [$id]), 201);
}

if ($method === 'GET' && $path === '/progress-photos') {
    $auth = requireAuth($config);
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : (int)$auth['user_id'];
    assertClientAccess($pdo, $auth, $clientId);
    jsonResponse(fetchAll($pdo, "SELECT * FROM progress_photos WHERE client_id=? ORDER BY date DESC", [$clientId]));
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'progress-photos' && $seg[2] === 'file') {
    $auth = requireAuth($config);
    $photo = fetchOne($pdo, "SELECT * FROM progress_photos WHERE id=?", [(int)$seg[1]]);
    if (!$photo) jsonResponse(['detail' => 'Fotka nenalezena'], 404);
    assertClientAccess($pdo, $auth, (int)$photo['client_id']);
    $fullPath = dirname($config['db_path']) . '/uploads/' . $photo['file_path'];
    if (!is_file($fullPath)) jsonResponse(['detail' => 'Soubor nenalezen'], 404);
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    $mime = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=3600');
    readfile($fullPath);
    exit;
}

if ($method === 'DELETE' && count($seg) === 2 && $seg[0] === 'progress-photos') {
    $auth = requireAuth($config);
    $photo = fetchOne($pdo, "SELECT * FROM progress_photos WHERE id=?", [(int)$seg[1]]);
    if ($photo) {
        assertClientAccess($pdo, $auth, (int)$photo['client_id']);
        @unlink(dirname($config['db_path']) . '/uploads/' . $photo['file_path']);
        $pdo->prepare("DELETE FROM progress_photos WHERE id=?")->execute([(int)$seg[1]]);
    }
    jsonResponse(['ok' => true]);
}

// ── E-SHOP — malý merch katalog, žádná platební brána (stejně jako subscriptions/
// payments níže), objednávka je jen záznam, který trenér ručně posouvá přes stavy. ───

if ($method === 'GET' && $path === '/shop-products') {
    $auth = requireAuth($config);
    $includeInactive = $auth['role'] === 'trainer' && !empty($_GET['include_inactive']);
    $sql = "SELECT * FROM shop_products" . ($includeInactive ? "" : " WHERE active=1") . " ORDER BY order_num, id";
    jsonResponse(fetchAll($pdo, $sql));
}

if ($method === 'POST' && $path === '/shop-products') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['name']) || empty($b['price_kc'])) jsonResponse(['detail' => 'name a price_kc jsou povinné'], 400);
    $id = insertRow($pdo, 'shop_products', [
        'trainer_id' => $auth['user_id'], 'name' => $b['name'], 'name_en' => $b['name_en'] ?? null,
        'description' => $b['description'] ?? null, 'description_en' => $b['description_en'] ?? null,
        'price_kc' => (int)$b['price_kc'], 'sizes' => $b['sizes'] ?? null, 'category' => $b['category'] ?? null,
        'order_num' => $b['order_num'] ?? 0,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM shop_products WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'shop-products') {
    $auth = requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT * FROM shop_products WHERE id=? AND trainer_id=?", [$id, $auth['user_id']]);
    if (!$existing) jsonResponse(['detail' => 'Produkt nenalezen'], 404);
    $b = jsonInput();
    $pdo->prepare("UPDATE shop_products SET name=?, name_en=?, description=?, description_en=?, price_kc=?, sizes=?, category=?, order_num=?, active=? WHERE id=?")->execute([
        $b['name'] ?? $existing['name'], $b['name_en'] ?? $existing['name_en'],
        $b['description'] ?? $existing['description'], $b['description_en'] ?? $existing['description_en'],
        $b['price_kc'] ?? $existing['price_kc'], array_key_exists('sizes', $b) ? $b['sizes'] : $existing['sizes'],
        $b['category'] ?? $existing['category'], $b['order_num'] ?? $existing['order_num'],
        isset($b['active']) ? (int)(bool)$b['active'] : $existing['active'], $id,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM shop_products WHERE id=?", [$id]));
}

if ($method === 'POST' && count($seg) === 3 && $seg[0] === 'shop-products' && $seg[2] === 'image') {
    $auth = requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $product = fetchOne($pdo, "SELECT * FROM shop_products WHERE id=? AND trainer_id=?", [$id, $auth['user_id']]);
    if (!$product) jsonResponse(['detail' => 'Produkt nenalezen'], 404);
    if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) jsonResponse(['detail' => 'image je povinné'], 400);
    $ext = strtolower(pathinfo((string)$_FILES['image']['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) jsonResponse(['detail' => 'Nepodporovaný formát obrázku'], 400);
    $dir = dirname($config['db_path']) . '/uploads/shop';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    if ($product['image_path']) @unlink($dir . '/' . $product['image_path']);
    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    move_uploaded_file($_FILES['image']['tmp_name'], $dir . '/' . $filename);
    $pdo->prepare("UPDATE shop_products SET image_path=? WHERE id=?")->execute([$filename, $id]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM shop_products WHERE id=?", [$id]));
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'shop-products' && $seg[2] === 'image') {
    requireAuth($config);
    $product = fetchOne($pdo, "SELECT * FROM shop_products WHERE id=?", [(int)$seg[1]]);
    if (!$product || !$product['image_path']) jsonResponse(['detail' => 'Obrázek nenalezen'], 404);
    $fullPath = dirname($config['db_path']) . '/uploads/shop/' . $product['image_path'];
    if (!is_file($fullPath)) jsonResponse(['detail' => 'Soubor nenalezen'], 404);
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    $mime = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=3600');
    readfile($fullPath);
    exit;
}

if ($method === 'GET' && $path === '/shop-orders/me') {
    $auth = requireAuth($config);
    jsonResponse(fetchAll($pdo, "
        SELECT so.*, sp.name AS product_name, sp.name_en AS product_name_en, sp.image_path AS product_image_path
        FROM shop_orders so JOIN shop_products sp ON sp.id = so.product_id
        WHERE so.client_id=? ORDER BY so.created_at DESC
    ", [$auth['user_id']]));
}

if ($method === 'GET' && $path === '/shop-orders') {
    $auth = requireRole($config, 'trainer');
    if (!empty($_GET['client_id'])) {
        assertClientAccess($pdo, $auth, (int)$_GET['client_id']);
        jsonResponse(fetchAll($pdo, "
            SELECT so.*, sp.name AS product_name, sp.name_en AS product_name_en FROM shop_orders so
            JOIN shop_products sp ON sp.id = so.product_id WHERE so.client_id=? ORDER BY so.created_at DESC
        ", [(int)$_GET['client_id']]));
    }
    jsonResponse(fetchAll($pdo, "
        SELECT so.*, sp.name AS product_name, sp.name_en AS product_name_en, u.display_name AS client_name
        FROM shop_orders so
        JOIN shop_products sp ON sp.id = so.product_id
        JOIN users u ON u.id = so.client_id
        ORDER BY so.created_at DESC
    "));
}

if ($method === 'POST' && $path === '/shop-orders') {
    $auth = requireAuth($config);
    $b = jsonInput();
    $clientId = (int)($b['client_id'] ?? $auth['user_id']);
    assertClientAccess($pdo, $auth, $clientId);
    $product = fetchOne($pdo, "SELECT * FROM shop_products WHERE id=? AND active=1", [(int)($b['product_id'] ?? 0)]);
    if (!$product) jsonResponse(['detail' => 'Produkt nenalezen'], 404);
    // price_kc se dopočítá ze serveru (aktuální cena produktu), nikdy z toho, co pošle klient.
    $id = insertRow($pdo, 'shop_orders', [
        'client_id' => $clientId, 'product_id' => (int)$product['id'], 'size' => $b['size'] ?? null,
        'quantity' => max(1, (int)($b['quantity'] ?? 1)), 'price_kc' => (int)$product['price_kc'], 'note' => $b['note'] ?? null,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM shop_orders WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 3 && $seg[0] === 'shop-orders' && $seg[2] === 'status') {
    $auth = requireRole($config, 'trainer');
    $order = fetchOne($pdo, "SELECT * FROM shop_orders WHERE id=?", [(int)$seg[1]]);
    if (!$order) jsonResponse(['detail' => 'Objednávka nenalezena'], 404);
    $b = jsonInput();
    if (!in_array($b['status'] ?? null, ['nová', 'zaplaceno', 'vyřízeno', 'zrušeno'], true)) {
        jsonResponse(['detail' => 'status musí být nová|zaplaceno|vyřízeno|zrušeno'], 400);
    }
    $pdo->prepare("UPDATE shop_orders SET status=? WHERE id=?")->execute([$b['status'], (int)$seg[1]]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM shop_orders WHERE id=?", [(int)$seg[1]]));
}

// ── PŘEDPLATNÉ A PLATBY (T6) — bez napojení na platební bránu (chybí API
// klíče), trenér platby zaznamenává ručně. ────────────────────────────

if ($method === 'GET' && $path === '/subscriptions') {
    $auth = requireRole($config, 'trainer');
    if (!empty($_GET['client_id'])) {
        assertClientAccess($pdo, $auth, (int)$_GET['client_id']);
        jsonResponse(fetchAll($pdo, "SELECT * FROM subscriptions WHERE client_id=? ORDER BY created_at DESC", [(int)$_GET['client_id']]));
    }
    jsonResponse(fetchAll($pdo, "SELECT s.*, u.display_name AS client_name FROM subscriptions s JOIN users u ON u.id=s.client_id ORDER BY s.created_at DESC"));
}

if ($method === 'GET' && $path === '/subscriptions/me') {
    $auth = requireAuth($config);
    jsonResponse(fetchAll($pdo, "SELECT * FROM subscriptions WHERE client_id=? ORDER BY created_at DESC", [$auth['user_id']]));
}

if ($method === 'POST' && $path === '/subscriptions') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    $clientId = (int)($b['client_id'] ?? 0);
    assertClientAccess($pdo, $auth, $clientId);
    if (empty($b['plan_name']) || empty($b['price_kc'])) jsonResponse(['detail' => 'plan_name a price_kc jsou povinné'], 400);
    // tier_id (volitelný odkaz na spravovaný katalog subscription_tiers) zrcadlí svůj
    // název do volného textu tier, ať zůstane zpětně kompatibilní zobrazení i pro
    // předplatná bez katalogového tieru.
    [$tierId, $tierName] = resolveTier($pdo, $auth['user_id'], $b);
    $id = insertRow($pdo, 'subscriptions', [
        'client_id' => $clientId, 'plan_name' => $b['plan_name'], 'price_kc' => (int)$b['price_kc'],
        'billing_period' => $b['billing_period'] ?? 'monthly', 'status' => 'active',
        'current_period_end' => $b['current_period_end'] ?? null, 'tier' => $tierName, 'tier_id' => $tierId,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM subscriptions WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'subscriptions') {
    $auth = requireRole($config, 'trainer');
    $existing = fetchOne($pdo, "SELECT * FROM subscriptions WHERE id=?", [(int)$seg[1]]);
    if (!$existing) jsonResponse(['detail' => 'Předplatné nenalezeno'], 404);
    assertClientAccess($pdo, $auth, (int)$existing['client_id']);
    $b = jsonInput();
    if (array_key_exists('tier_id', $b) || array_key_exists('tier', $b)) {
        [$tierId, $tierName] = resolveTier($pdo, $auth['user_id'], $b);
    } else {
        $tierId = $existing['tier_id']; $tierName = $existing['tier'];
    }
    $pdo->prepare("UPDATE subscriptions SET plan_name=?, price_kc=?, billing_period=?, status=?, current_period_end=?, tier=?, tier_id=? WHERE id=?")->execute([
        $b['plan_name'] ?? $existing['plan_name'], $b['price_kc'] ?? $existing['price_kc'],
        $b['billing_period'] ?? $existing['billing_period'], $b['status'] ?? $existing['status'],
        $b['current_period_end'] ?? $existing['current_period_end'], $tierName, $tierId, (int)$seg[1],
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM subscriptions WHERE id=?", [(int)$seg[1]]));
}

// ── SPRAVOVANÝ KATALOG TIERŮ A SLUŽEB (viz db.php gate 8) ───────────

if ($method === 'GET' && $path === '/subscription-tiers') {
    $auth = requireRole($config, 'trainer');
    $includeInactive = !empty($_GET['include_inactive']);
    $sql = "SELECT * FROM subscription_tiers WHERE trainer_id=?" . ($includeInactive ? "" : " AND active=1") . " ORDER BY order_num, id";
    $tiers = fetchAll($pdo, $sql, [$auth['user_id']]);
    foreach ($tiers as &$tier) {
        $tier['service_ids'] = array_map('intval', array_column(
            fetchAll($pdo, "SELECT service_id FROM tier_service_map WHERE tier_id=?", [(int)$tier['id']]), 'service_id'
        ));
    }
    unset($tier);
    jsonResponse($tiers);
}

if ($method === 'POST' && $path === '/subscription-tiers') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $id = insertRow($pdo, 'subscription_tiers', [
        'trainer_id' => $auth['user_id'], 'name' => $b['name'], 'name_en' => $b['name_en'] ?? null,
        'price_kc' => $b['price_kc'] ?? null, 'order_num' => $b['order_num'] ?? 0,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM subscription_tiers WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'subscription-tiers') {
    $auth = requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT * FROM subscription_tiers WHERE id=? AND trainer_id=?", [$id, $auth['user_id']]);
    if (!$existing) jsonResponse(['detail' => 'Tier nenalezen'], 404);
    $b = jsonInput();
    $pdo->prepare("UPDATE subscription_tiers SET name=?, name_en=?, price_kc=?, order_num=?, active=? WHERE id=?")->execute([
        $b['name'] ?? $existing['name'], $b['name_en'] ?? $existing['name_en'],
        $b['price_kc'] ?? $existing['price_kc'], $b['order_num'] ?? $existing['order_num'],
        isset($b['active']) ? (int)(bool)$b['active'] : $existing['active'], $id,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM subscription_tiers WHERE id=?", [$id]));
}

// Nahradí celou množinu služeb pro daný tier (jednodušší než diff, odpovídá
// checkbox-list UI na Tiers.jsx) — service_ids musí patřit stejnému trenérovi.
if ($method === 'PUT' && count($seg) === 3 && $seg[0] === 'subscription-tiers' && $seg[2] === 'services') {
    $auth = requireRole($config, 'trainer');
    $tierId = (int)$seg[1];
    $tier = fetchOne($pdo, "SELECT id FROM subscription_tiers WHERE id=? AND trainer_id=?", [$tierId, $auth['user_id']]);
    if (!$tier) jsonResponse(['detail' => 'Tier nenalezen'], 404);
    $b = jsonInput();
    $serviceIds = array_map('intval', $b['service_ids'] ?? []);
    $pdo->prepare("DELETE FROM tier_service_map WHERE tier_id=?")->execute([$tierId]);
    $stmt = $pdo->prepare("INSERT INTO tier_service_map (tier_id, service_id) SELECT ?, id FROM tier_services WHERE id=? AND trainer_id=?");
    foreach ($serviceIds as $serviceId) { $stmt->execute([$tierId, $serviceId, $auth['user_id']]); }
    jsonResponse(['ok' => true]);
}

if ($method === 'GET' && $path === '/tier-services') {
    $auth = requireRole($config, 'trainer');
    $includeInactive = !empty($_GET['include_inactive']);
    $sql = "SELECT * FROM tier_services WHERE trainer_id=?" . ($includeInactive ? "" : " AND active=1") . " ORDER BY name";
    jsonResponse(fetchAll($pdo, $sql, [$auth['user_id']]));
}

if ($method === 'POST' && $path === '/tier-services') {
    $auth = requireRole($config, 'trainer');
    $b = jsonInput();
    if (empty($b['name'])) jsonResponse(['detail' => 'name je povinné'], 400);
    $id = insertRow($pdo, 'tier_services', ['trainer_id' => $auth['user_id'], 'name' => $b['name'], 'name_en' => $b['name_en'] ?? null]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM tier_services WHERE id=?", [$id]), 201);
}

if ($method === 'PUT' && count($seg) === 2 && $seg[0] === 'tier-services') {
    $auth = requireRole($config, 'trainer');
    $id = (int)$seg[1];
    $existing = fetchOne($pdo, "SELECT * FROM tier_services WHERE id=? AND trainer_id=?", [$id, $auth['user_id']]);
    if (!$existing) jsonResponse(['detail' => 'Služba nenalezena'], 404);
    $b = jsonInput();
    $pdo->prepare("UPDATE tier_services SET name=?, name_en=?, active=? WHERE id=?")->execute([
        $b['name'] ?? $existing['name'], $b['name_en'] ?? $existing['name_en'],
        isset($b['active']) ? (int)(bool)$b['active'] : $existing['active'], $id,
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM tier_services WHERE id=?", [$id]));
}

if ($method === 'GET' && $path === '/payments') {
    $auth = requireAuth($config);
    if (!empty($_GET['subscription_id'])) {
        $sub = fetchOne($pdo, "SELECT * FROM subscriptions WHERE id=?", [(int)$_GET['subscription_id']]);
        if (!$sub) jsonResponse(['detail' => 'Předplatné nenalezeno'], 404);
        assertClientAccess($pdo, $auth, (int)$sub['client_id']);
        jsonResponse(fetchAll($pdo, "SELECT * FROM payments WHERE subscription_id=? ORDER BY paid_at DESC", [(int)$_GET['subscription_id']]));
    }
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : (int)$auth['user_id'];
    assertClientAccess($pdo, $auth, $clientId);
    jsonResponse(fetchAll($pdo,
        "SELECT p.* FROM payments p JOIN subscriptions s ON s.id=p.subscription_id WHERE s.client_id=? ORDER BY p.paid_at DESC",
        [$clientId]
    ));
}

if ($method === 'POST' && $path === '/payments') {
    requireRole($config, 'trainer');
    $b = jsonInput();
    $sub = fetchOne($pdo, "SELECT * FROM subscriptions WHERE id=?", [(int)($b['subscription_id'] ?? 0)]);
    if (!$sub) jsonResponse(['detail' => 'Předplatné nenalezeno'], 404);
    if (empty($b['amount_kc']) || empty($b['paid_at'])) jsonResponse(['detail' => 'amount_kc a paid_at jsou povinné'], 400);
    $id = insertRow($pdo, 'payments', [
        'subscription_id' => (int)$sub['id'], 'amount_kc' => (int)$b['amount_kc'],
        'method' => $b['method'] ?? 'manual', 'note' => $b['note'] ?? null, 'paid_at' => $b['paid_at'],
    ]);
    jsonResponse(fetchOne($pdo, "SELECT * FROM payments WHERE id=?", [$id]), 201);
}

// ── PRs, HISTORIE (K4) ──────────────────────────────────────────────

// Epleyho vzorec pro odhad 1RM z odcvičené série — dostatečně přesný pro POC účely.
function epley1rm(float $weightKg, int $reps): float
{
    return $reps <= 1 ? $weightKg : $weightKg * (1 + $reps / 30);
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'prs') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    $logs = fetchAll($pdo, "
        SELECT el.actual_reps, el.actual_weight_kg, el.logged_at, e.id AS exercise_id, e.name AS exercise_name, e.name_en AS exercise_name_en
        FROM exercise_logs el
        JOIN workout_exercises we ON we.id = el.workout_exercise_id
        JOIN workouts w ON w.id = we.workout_id
        JOIN exercises e ON e.id = we.exercise_id
        WHERE w.client_id=? AND el.actual_weight_kg IS NOT NULL AND el.actual_reps IS NOT NULL
    ", [(int)$seg[1]]);
    $prs = [];
    foreach ($logs as $l) {
        $exId = (int)$l['exercise_id'];
        $weight = (float)$l['actual_weight_kg'];
        $est = epley1rm($weight, (int)$l['actual_reps']);
        $prs[$exId] ??= ['exercise_id' => $exId, 'exercise_name' => $l['exercise_name'], 'exercise_name_en' => $l['exercise_name_en']];
        if (!isset($prs[$exId]['best_weight_kg']) || $weight > $prs[$exId]['best_weight_kg']) {
            $prs[$exId]['best_weight_kg'] = $weight;
            $prs[$exId]['best_weight_date'] = $l['logged_at'];
        }
        if (!isset($prs[$exId]['est_1rm']) || $est > $prs[$exId]['est_1rm']) {
            $prs[$exId]['est_1rm'] = round($est, 1);
            $prs[$exId]['est_1rm_date'] = $l['logged_at'];
        }
    }
    jsonResponse(array_values($prs));
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'clients' && $seg[2] === 'history') {
    $auth = requireAuth($config);
    assertClientAccess($pdo, $auth, (int)$seg[1]);
    $workouts = fetchAll($pdo,
        "SELECT * FROM workouts WHERE client_id=? AND status='completed' ORDER BY date DESC LIMIT 50",
        [(int)$seg[1]]
    );
    foreach ($workouts as &$w) {
        $w['exercises'] = fetchAll($pdo,
            "SELECT we.*, e.name, e.name_en FROM workout_exercises we JOIN exercises e ON e.id=we.exercise_id WHERE we.workout_id=? ORDER BY we.\"order\"",
            [(int)$w['id']]
        );
        foreach ($w['exercises'] as &$ex) {
            $ex['logs'] = fetchAll($pdo, "SELECT * FROM exercise_logs WHERE workout_exercise_id=? ORDER BY set_number", [(int)$ex['id']]);
        }
        unset($ex);
    }
    unset($w);
    jsonResponse($workouts);
}

// ── GDPR ────────────────────────────────────────────────────────────

if ($method === 'GET' && $path === '/me/export') {
    $auth = requireAuth($config);
    $uid = (int)$auth['user_id'];
    $data = ['user' => fetchOne($pdo, "SELECT id, email, role, display_name, created_at FROM users WHERE id=?", [$uid])];
    if ($auth['role'] === 'client') {
        $data['workouts'] = fetchAll($pdo, "SELECT * FROM workouts WHERE client_id=?", [$uid]);
        $data['goals'] = fetchAll($pdo, "SELECT * FROM goals WHERE client_id=?", [$uid]);
        $data['body_metrics'] = fetchAll($pdo, "SELECT * FROM body_metrics WHERE client_id=?", [$uid]);
        $data['nutrition_plans'] = fetchAll($pdo, "SELECT * FROM nutrition_plans WHERE client_id=?", [$uid]);
        $data['messages'] = fetchAll($pdo, "SELECT * FROM messages WHERE sender_id=? OR recipient_id=?", [$uid, $uid]);
        $data['subscriptions'] = fetchAll($pdo, "SELECT * FROM subscriptions WHERE client_id=?", [$uid]);
        $data['one_rms'] = fetchAll($pdo, "SELECT * FROM client_one_rms WHERE client_id=?", [$uid]);
        $data['progress_photos'] = fetchAll($pdo, "SELECT id, date, note, created_at FROM progress_photos WHERE client_id=?", [$uid]);
    }
    jsonResponse($data);
}

// ── HLASOVÝ TRÉNINKOVÝ DENÍK (muj.bloodandguts.cz) ────────────────────
// Samostatný produkt pro roli 'diary' — žádný trenér, žádný vztah k users.role='client'.

function groupDiarySetsByExercise(array $sets): array
{
    $byExercise = [];
    foreach ($sets as $s) {
        $byExercise[$s['order_num']]['name'] ??= $s['exercise_name'];
        $byExercise[$s['order_num']]['type'] ??= $s['exercise_type'] ?? 'strength';
        $byExercise[$s['order_num']]['sets'][] = [
            'set_number' => (int)$s['set_number'], 'reps' => $s['reps'] !== null ? (int)$s['reps'] : null,
            'weight_kg' => $s['weight_kg'] !== null ? (float)$s['weight_kg'] : null,
            'duration_min' => $s['duration_min'] !== null ? (float)$s['duration_min'] : null,
            'distance_km' => $s['distance_km'] !== null ? (float)$s['distance_km'] : null,
            'own_weight' => !empty($s['own_weight']),
        ];
    }
    ksort($byExercise);
    return array_values($byExercise);
}

function fetchDiaryEntryWithSets(PDO $pdo, int $entryId): ?array
{
    $entry = fetchOne($pdo, "SELECT * FROM diary_entries WHERE id=?", [$entryId]);
    if (!$entry) return null;
    $sets = fetchAll($pdo, "SELECT * FROM diary_sets WHERE entry_id=? ORDER BY order_num, set_number", [$entryId]);
    $entry['exercises'] = groupDiarySetsByExercise($sets);
    return $entry;
}

// Hromadná varianta fetchDiaryEntryWithSets() pro seznam všech záznamů uživatele — 2 dotazy
// celkem místo 1+2N (dřív se volalo fetchDiaryEntryWithSets() zvlášť pro každý řádek).
function fetchDiaryEntriesForUser(PDO $pdo, int $userId): array
{
    $entries = fetchAll($pdo, "SELECT * FROM diary_entries WHERE user_id=? ORDER BY recorded_at DESC, id DESC", [$userId]);
    if (empty($entries)) return [];
    $ids = array_column($entries, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $allSets = fetchAll($pdo, "SELECT * FROM diary_sets WHERE entry_id IN ($placeholders) ORDER BY entry_id, order_num, set_number", $ids);
    $setsByEntry = [];
    foreach ($allSets as $s) {
        $setsByEntry[$s['entry_id']][] = $s;
    }
    foreach ($entries as &$entry) {
        $entry['exercises'] = groupDiarySetsByExercise($setsByEntry[$entry['id']] ?? []);
    }
    unset($entry);
    return $entries;
}

// Pokud uživatel namluví trénink po částech (rozcvička/hlavní část/kardio zvlášť), sloučí
// nové cviky do existujících podle názvu (case-insensitive) — série se přičtou k té samé
// cvičební položce místo duplicitního bloku se stejným jménem.
function mergeExerciseLists(array $existing, array $incoming): array
{
    foreach ($incoming as $newEx) {
        $name = trim((string)($newEx['name'] ?? ''));
        $matched = false;
        foreach ($existing as &$ex) {
            if (mb_strtolower(trim((string)$ex['name'])) === mb_strtolower($name)) {
                $nextSetNum = count($ex['sets']) + 1;
                foreach ($newEx['sets'] ?? [] as $s) {
                    $s['set_number'] = $nextSetNum++;
                    $ex['sets'][] = $s;
                }
                $matched = true;
                break;
            }
        }
        unset($ex);
        if (!$matched) $existing[] = $newEx;
    }
    return $existing;
}

function replaceDiarySets(PDO $pdo, int $entryId, array $exercises): void
{
    $pdo->prepare("DELETE FROM diary_sets WHERE entry_id=?")->execute([$entryId]);
    $order = 0;
    foreach ($exercises as $ex) {
        $name = trim((string)($ex['name'] ?? ''));
        if ($name === '') { $order++; continue; }
        $type = in_array($ex['type'] ?? null, ['strength', 'cardio'], true) ? $ex['type'] : 'strength';
        foreach ($ex['sets'] ?? [] as $set) {
            insertRow($pdo, 'diary_sets', [
                'entry_id' => $entryId, 'exercise_name' => $name, 'exercise_type' => $type, 'order_num' => $order,
                'set_number' => (int)($set['set_number'] ?? 1),
                'reps' => isset($set['reps']) ? (int)$set['reps'] : null,
                'weight_kg' => isset($set['weight_kg']) ? (float)$set['weight_kg'] : null,
                'duration_min' => isset($set['duration_min']) ? (float)$set['duration_min'] : null,
                'distance_km' => isset($set['distance_km']) ? (float)$set['distance_km'] : null,
                'own_weight' => !empty($set['own_weight']) ? 1 : 0,
            ]);
        }
        $order++;
    }
}

if ($method === 'POST' && $path === '/diary/register') {
    $b = jsonInput();
    $email = trim(strtolower((string)($b['email'] ?? '')));
    $name  = trim((string)($b['display_name'] ?? ''));
    $password = (string)($b['password'] ?? '');
    if ($email === '' || $name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['detail' => 'Platný e-mail a jméno jsou povinné'], 400);
    }
    if (strlen($password) < 6) {
        jsonResponse(['detail' => 'Heslo musí mít aspoň 6 znaků'], 400);
    }
    $goal = in_array($b['goal'] ?? null, ['sila', 'objem', 'mix'], true) ? $b['goal'] : null;

    if (fetchOne($pdo, "SELECT id FROM users WHERE email=?", [$email])) {
        jsonResponse(['detail' => 'Tento e-mail už je použitý, přihlas se.'], 409);
    }
    $id = insertRow($pdo, 'users', [
        'email' => $email, 'role' => 'diary', 'display_name' => $name, 'diary_goal' => $goal,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    ]);
    $user = fetchOne($pdo, "SELECT * FROM users WHERE id=?", [$id]);
    jsonResponse(['access_token' => tokenFor($config, $user), 'user' => userPublic($user)], 201);
}

if ($method === 'POST' && $path === '/diary/login') {
    $b = jsonInput();
    $email = trim(strtolower((string)($b['email'] ?? '')));
    $password = (string)($b['password'] ?? '');
    $user = fetchOne($pdo, "SELECT * FROM users WHERE email=? AND role='diary'", [$email]);
    if (!$user || !$user['password_hash'] || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['detail' => 'Nesprávný e-mail nebo heslo.'], 401);
    }
    jsonResponse(['access_token' => tokenFor($config, $user), 'user' => userPublic($user)]);
}

if ($method === 'POST' && $path === '/diary/reset-request') {
    $b = jsonInput();
    $email = trim(strtolower((string)($b['email'] ?? '')));
    $user = fetchOne($pdo, "SELECT * FROM users WHERE email=? AND role='diary'", [$email]);
    if ($user) {
        $token = bin2hex(random_bytes(32));
        insertRow($pdo, 'password_resets', [
            'user_id' => $user['id'], 'token_hash' => hash('sha256', $token),
            'expires_at' => date('Y-m-d H:i:s', time() + 3600),
        ]);
        $appOrigin = $reqOrigin ?: 'https://muj.bloodandguts.cz';
        $link = "{$appOrigin}/diary/reset-confirm?token={$token}";
        sendMail($config, $email, 'Obnovení hesla — Můj trénink', implode("\n", [
            'Ahoj,', '',
            'někdo (doufáme že ty) požádal o obnovení hesla k účtu Můj trénink.', '',
            'Klikni na odkaz níže, platí 1 hodinu:', $link, '',
            'Pokud jsi o reset nežádal(a), tenhle e-mail můžeš ignorovat.',
        ]));
    }
    // Vždy stejná odpověď bez ohledu na to, jestli e-mail existuje — jinak by endpoint šel
    // zneužít k ověření, které e-maily u nás mají účet.
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && $path === '/diary/reset-confirm') {
    $b = jsonInput();
    $token = (string)($b['token'] ?? '');
    $password = (string)($b['password'] ?? '');
    if (strlen($password) < 6) jsonResponse(['detail' => 'Heslo musí mít aspoň 6 znaků'], 400);
    $reset = fetchOne($pdo, "SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > ?", [hash('sha256', $token), date('Y-m-d H:i:s')]);
    if (!$reset) jsonResponse(['detail' => 'Odkaz je neplatný nebo vypršel.'], 400);
    $user = fetchOne($pdo, "SELECT * FROM users WHERE id=?", [$reset['user_id']]);
    if (!$user) jsonResponse(['detail' => 'Odkaz je neplatný nebo vypršel.'], 400);
    $pdo->prepare("UPDATE users SET password_hash=? WHERE id=?")->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    $pdo->prepare("UPDATE password_resets SET used_at=? WHERE id=?")->execute([date('Y-m-d H:i:s'), (int)$reset['id']]);
    jsonResponse(['access_token' => tokenFor($config, $user), 'user' => userPublic($user)]);
}

// Sebeobslužné smazání vlastního účtu — appka dřív neměla žádný způsob, jak diary účet
// odstranit (jen "hide-not-delete" vzor u jiných entit), takže si e2e sada
// (e2e/tests-diary/diary.spec.js) musela nechávat jednorázové testovací účty na produkci
// navždy. ON DELETE CASCADE na users(id) smaže i diary_entries/diary_sets/
// diary_audio_uploads/diary_suggestions/password_resets automaticky (PRAGMA foreign_keys=ON
// v db.php).
if ($method === 'DELETE' && $path === '/diary/me') {
    $auth = requireRole($config, 'diary');
    $pdo->prepare("DELETE FROM users WHERE id=?")->execute([$auth['user_id']]);
    jsonResponse(['ok' => true]);
}

if ($method === 'PUT' && $path === '/diary/goal') {
    $auth = requireRole($config, 'diary');
    $b = jsonInput();
    if (!in_array($b['goal'] ?? null, ['sila', 'objem', 'mix'], true)) {
        jsonResponse(['detail' => 'goal musí být sila|objem|mix'], 400);
    }
    $pdo->prepare("UPDATE users SET diary_goal=? WHERE id=?")->execute([$b['goal'], $auth['user_id']]);
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && $path === '/diary/upload') {
    $auth = requireRole($config, 'diary');
    if (empty($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['detail' => 'audio je povinné'], 400);
    }
    set_time_limit(120);
    $userId = (int)$auth['user_id'];
    $ext = strtolower(pathinfo((string)$_FILES['audio']['name'], PATHINFO_EXTENSION)) ?: 'webm';
    $dir = dirname($config['db_path']) . '/uploads/diary/' . $userId;
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    move_uploaded_file($_FILES['audio']['tmp_name'], $dir . '/' . $filename);

    $uploadId = insertRow($pdo, 'diary_audio_uploads', [
        'user_id' => $userId, 'file_path' => $userId . '/' . $filename, 'mime_type' => $_FILES['audio']['type'] ?? null,
    ]);

    try {
        $transcript = whisperTranscribe($config, $dir . '/' . $filename, $_FILES['audio']['type'] ?? 'audio/webm');
        $known = fetchAll($pdo, "SELECT exercise_name, MAX(de.recorded_at) AS last_used FROM diary_sets ds
                                  JOIN diary_entries de ON de.id=ds.entry_id WHERE de.user_id=?
                                  GROUP BY exercise_name ORDER BY last_used DESC LIMIT 20", [$userId]);
        $parsed = claudeStructureWorkout($config, $transcript, array_column($known, 'exercise_name'));
    } catch (\Throwable $e) {
        $pdo->prepare("UPDATE diary_audio_uploads SET transcription_status='failed', error_message=? WHERE id=?")
            ->execute([$e->getMessage(), $uploadId]);
        logError('diary/upload zpracování selhalo: ' . $e->getMessage());
        // whisperTranscribe() u nesrozumitelné/tiché nahrávky hodí vlastní srozumitelnou českou
        // zprávu (viz ai.php isLikelyHallucination()) — tu chceme ukázat uživateli přímo, ne
        // schovat za obecnou hlášku. Ostatní výjimky (síť, API chyby) obecnou hláškou zůstávají,
        // ať se do UI nedostane syrový technický text.
        $detail = str_starts_with($e->getMessage(), 'Nahrávka nezněla srozumitelně')
            ? $e->getMessage() : 'Zpracování nahrávky selhalo, zkus to prosím znovu.';
        jsonResponse(['detail' => $detail], 502);
    }

    // Další namluvení do 120 minut od předchozího záznamu téhož dne = pokračování stejného
    // tréninku (rozcvička/hlavní část/kardio zvlášť namluvené zvlášť), ne nový samostatný
    // záznam — sloučí se cviky/série do toho existujícího místo založení dalšího řádku.
    $date = $parsed['date'] ?? date('Y-m-d');
    $mergeWindowSec = 120 * 60;
    $existing = fetchOne($pdo, "SELECT * FROM diary_entries WHERE user_id=? AND recorded_at=? ORDER BY id DESC LIMIT 1", [$userId, $date]);
    $mergeTarget = null;
    if ($existing) {
        $lastActivity = strtotime($existing['created_at'] . ' UTC');
        if ($lastActivity !== false && (time() - $lastActivity) <= $mergeWindowSec) {
            $mergeTarget = $existing;
        }
    }

    if ($mergeTarget) {
        $entryId = (int)$mergeTarget['id'];
        $existingSets = fetchAll($pdo, "SELECT * FROM diary_sets WHERE entry_id=? ORDER BY order_num, set_number", [$entryId]);
        $mergedExercises = mergeExerciseLists(groupDiarySetsByExercise($existingSets), $parsed['exercises'] ?? []);
        replaceDiarySets($pdo, $entryId, $mergedExercises);
        $mergedTranscript = trim(($mergeTarget['transcript'] ?? '') . "\n\n" . $transcript);
        $mergedNotes = trim(implode("\n", array_filter([$mergeTarget['notes'] ?? null, $parsed['notes'] ?? null], fn($v) => $v !== null && $v !== '')));
        $status = ($parsed['confidence'] ?? 'high') === 'low' ? 'needs_review' : $mergeTarget['status'];
        $pdo->prepare("UPDATE diary_entries SET transcript=?, ai_raw_json=?, notes=?, status=? WHERE id=?")
            ->execute([$mergedTranscript, json_encode($parsed, JSON_UNESCAPED_UNICODE), $mergedNotes ?: null, $status, $entryId]);
    } else {
        $entryId = insertRow($pdo, 'diary_entries', [
            'user_id' => $userId, 'recorded_at' => $date,
            'transcript' => $transcript, 'ai_raw_json' => json_encode($parsed, JSON_UNESCAPED_UNICODE),
            'status' => ($parsed['confidence'] ?? 'high') === 'low' ? 'needs_review' : 'parsed',
            'notes' => $parsed['notes'] ?? null,
        ]);
        replaceDiarySets($pdo, $entryId, $parsed['exercises'] ?? []);
    }
    $pdo->prepare("UPDATE diary_audio_uploads SET transcription_status='ok', entry_id=? WHERE id=?")->execute([$entryId, $uploadId]);
    jsonResponse(fetchDiaryEntryWithSets($pdo, $entryId), 201);
}

if ($method === 'POST' && $path === '/diary/entries') {
    $auth = requireRole($config, 'diary');
    $b = jsonInput();
    $userId = (int)$auth['user_id'];
    $entryId = insertRow($pdo, 'diary_entries', [
        'user_id' => $userId, 'recorded_at' => trim((string)($b['recorded_at'] ?? '')) ?: date('Y-m-d'),
        'transcript' => null, 'ai_raw_json' => null, 'status' => 'parsed',
        'notes' => $b['notes'] ?? null, 'start_time' => $b['start_time'] ?? null, 'end_time' => $b['end_time'] ?? null,
    ]);
    replaceDiarySets($pdo, $entryId, $b['exercises'] ?? []);
    jsonResponse(fetchDiaryEntryWithSets($pdo, $entryId), 201);
}

if ($method === 'GET' && $path === '/diary/entries') {
    $auth = requireRole($config, 'diary');
    jsonResponse(fetchDiaryEntriesForUser($pdo, (int)$auth['user_id']));
}

if ($method === 'GET' && count($seg) === 3 && $seg[0] === 'diary' && $seg[1] === 'entries') {
    $auth = requireRole($config, 'diary');
    $entry = fetchDiaryEntryWithSets($pdo, (int)$seg[2]);
    if (!$entry || (int)$entry['user_id'] !== (int)$auth['user_id']) jsonResponse(['detail' => 'Záznam nenalezen'], 404);
    jsonResponse($entry);
}

if ($method === 'PUT' && count($seg) === 3 && $seg[0] === 'diary' && $seg[1] === 'entries') {
    $auth = requireRole($config, 'diary');
    $entry = fetchOne($pdo, "SELECT * FROM diary_entries WHERE id=?", [(int)$seg[2]]);
    if (!$entry || (int)$entry['user_id'] !== (int)$auth['user_id']) jsonResponse(['detail' => 'Záznam nenalezen'], 404);
    $b = jsonInput();
    $pdo->prepare("UPDATE diary_entries SET recorded_at=?, notes=?, start_time=?, end_time=?, status='parsed' WHERE id=?")->execute([
        trim((string)($b['recorded_at'] ?? $entry['recorded_at'])), $b['notes'] ?? $entry['notes'],
        $b['start_time'] ?? $entry['start_time'] ?? null, $b['end_time'] ?? $entry['end_time'] ?? null,
        (int)$seg[2],
    ]);
    if (isset($b['exercises'])) replaceDiarySets($pdo, (int)$seg[2], $b['exercises']);
    jsonResponse(fetchDiaryEntryWithSets($pdo, (int)$seg[2]));
}

if ($method === 'DELETE' && count($seg) === 3 && $seg[0] === 'diary' && $seg[1] === 'entries') {
    $auth = requireRole($config, 'diary');
    $entry = fetchOne($pdo, "SELECT * FROM diary_entries WHERE id=?", [(int)$seg[2]]);
    if ($entry && (int)$entry['user_id'] === (int)$auth['user_id']) {
        $pdo->prepare("DELETE FROM diary_entries WHERE id=?")->execute([(int)$seg[2]]);
    }
    jsonResponse(['ok' => true]);
}

if ($method === 'GET' && $path === '/diary/next-workout') {
    $auth = requireRole($config, 'diary');
    $userId = (int)$auth['user_id'];
    $user = fetchOne($pdo, "SELECT * FROM users WHERE id=?", [$userId]);
    $lastEntry = fetchOne($pdo, "SELECT MAX(recorded_at) AS d FROM diary_entries WHERE user_id=?", [$userId]);
    $fresh = fetchOne($pdo, "SELECT * FROM diary_suggestions WHERE user_id=? ORDER BY created_at DESC LIMIT 1", [$userId]);

    $stillFresh = $fresh
        && (!$lastEntry['d'] || $fresh['created_at'] >= $lastEntry['d'])
        && strtotime($fresh['created_at']) > time() - 12 * 3600;
    if ($stillFresh) {
        jsonResponse(json_decode($fresh['suggestion_json'], true));
    }

    $history = fetchAll($pdo, "SELECT de.recorded_at, ds.exercise_name, ds.set_number, ds.reps, ds.weight_kg
        FROM diary_sets ds JOIN diary_entries de ON de.id=ds.entry_id WHERE de.user_id=?
        ORDER BY de.recorded_at DESC LIMIT 200", [$userId]);

    try {
        $suggestion = claudeSuggestNextWorkout($config, $user['diary_goal'] ?? 'mix', $history);
    } catch (\Throwable $e) {
        logError('diary/next-workout selhalo: ' . $e->getMessage());
        jsonResponse(['detail' => 'Návrh se nepodařilo vygenerovat, zkus to prosím znovu.'], 502);
    }

    insertRow($pdo, 'diary_suggestions', [
        'user_id' => $userId, 'goal_snapshot' => $user['diary_goal'] ?? null,
        'suggestion_json' => json_encode($suggestion, JSON_UNESCAPED_UNICODE), 'based_on_entry_count' => count($history),
    ]);
    jsonResponse($suggestion);
}

jsonResponse(['detail' => 'Not found'], 404);
