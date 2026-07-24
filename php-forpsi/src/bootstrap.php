<?php
declare(strict_types=1);

function loadConfig(): array
{
    $cfg = null;
    foreach ([__DIR__ . '/config.php', __DIR__ . '/../src/config.php'] as $f) {
        if (is_file($f)) { $cfg = require $f; break; }
    }
    if ($cfg === null) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Chybí src/config.php'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $cfg;
}

function jsonResponse(mixed $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonInput(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw || trim($raw) === '') return [];
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

// ── JWT (HS256, bez závislostí) ────────────────────────────────────────
function b64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string
{
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

function jwt_create(array $payload, string $secret): string
{
    $header = b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $body   = b64url(json_encode($payload));
    $sig    = b64url(hash_hmac('sha256', "$header.$body", $secret, true));
    return "$header.$body.$sig";
}

function jwt_verify(string $token, string $secret): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$h, $b, $s] = $parts;
    $expected = b64url(hash_hmac('sha256', "$h.$b", $secret, true));
    if (!hash_equals($expected, $s)) return null;
    $payload = json_decode(b64url_decode($b), true);
    if (!is_array($payload)) return null;
    if (isset($payload['exp']) && $payload['exp'] < time()) return null;
    return $payload;
}

function getBearerToken(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        $ah = getallheaders();
        $header = $ah['Authorization'] ?? '';
    }
    if ($header === '') {
        $xToken = $_SERVER['HTTP_X_AUTH_TOKEN']
               ?? (function_exists('getallheaders') ? (getallheaders()['X-Auth-Token'] ?? '') : '');
        if ($xToken !== '') $header = 'Bearer ' . $xToken;
    }
    return $header;
}

function requireAuth(array $config): array
{
    $header = getBearerToken();
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        jsonResponse(['detail' => 'Unauthorized'], 401);
    }
    $payload = jwt_verify($m[1], $config['jwt_secret']);
    if (!$payload) {
        jsonResponse(['detail' => 'Token neplatný nebo vypršel'], 401);
    }
    return $payload;
}

function requireRole(array $config, string $role): array
{
    $payload = requireAuth($config);
    if (($payload['role'] ?? '') !== $role) {
        jsonResponse(['detail' => 'Přístup zamítnut'], 403);
    }
    return $payload;
}

function logError(string $message): void
{
    $logFile = defined('ERROR_LOG_FILE')
        ? ERROR_LOG_FILE
        : __DIR__ . '/../data/error.log';
    @file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL, FILE_APPEND | LOCK_EX);
}

set_exception_handler(function (Throwable $e): void {
    logError(get_class($e) . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Interní chyba serveru'], JSON_UNESCAPED_UNICODE);
    exit;
});

set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    logError("PHP Error [$severity]: $message in $file:$line");
    return true;
});
