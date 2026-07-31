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

// Minimalistický SMTP klient — přenesený ze stejného řešení na Kamata.cz (2026-07-31), kde
// nahradil syrové PHP mail() (Forpsi ho nikdy nepodepisuje DKIM, takže s DMARC p=quarantine
// pošta padala do spamu). Composer v tomhle prostředí není k dispozici (žádný vendor/), takže
// místo PHPMailer jde o vlastní ~90řádkový klient (EHLO/STARTTLS/AUTH LOGIN/MAIL FROM/RCPT
// TO/DATA) — protokol je dost jednoduchý na to, aby se nevyplatilo tahat závislost jen kvůli
// tomuhle. Používá se zatím jen pro reset hesla role 'diary' (muj.bloodandguts.cz).
function smtpSend(array $config, string $to, string $rawMessage): bool
{
    $host = $config['smtp_host'] ?? 'smtp.forpsi.com';
    $port = (int)($config['smtp_port'] ?? 587);
    $user = $config['smtp_user'] ?? null;
    $pass = $config['smtp_pass'] ?? null;
    if (!$user || !$pass) {
        logError('smtpSend: chybí smtp_user/smtp_pass v konfiguraci');
        return false;
    }

    $sock = @stream_socket_client("tcp://$host:$port", $errno, $errstr, 15);
    if (!$sock) {
        logError("smtpSend: připojení na $host:$port selhalo ($errno) $errstr");
        return false;
    }
    stream_set_timeout($sock, 15);

    $readResponse = function () use ($sock): string {
        $resp = '';
        while (($line = fgets($sock, 515)) !== false) {
            $resp .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') break;
        }
        return $resp;
    };
    $code = fn(string $resp): int => (int)substr($resp, 0, 3);
    $cmd = function (string $command) use ($sock, $readResponse): string {
        fwrite($sock, $command . "\r\n");
        return $readResponse();
    };

    $fail = function (string $where, string $resp) use ($sock): false {
        logError("smtpSend: $where selhalo: " . trim($resp));
        fclose($sock);
        return false;
    };

    $greeting = $readResponse();
    if ($code($greeting) !== 220) return $fail('spojení', $greeting);

    $localHost = 'bloodandguts.cz';
    $resp = $cmd("EHLO $localHost");
    if ($code($resp) !== 250) return $fail('EHLO', $resp);

    $resp = $cmd('STARTTLS');
    if ($code($resp) !== 220) return $fail('STARTTLS', $resp);

    if (!@stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        logError('smtpSend: TLS handshake selhal');
        fclose($sock);
        return false;
    }

    $resp = $cmd("EHLO $localHost");
    if ($code($resp) !== 250) return $fail('EHLO po STARTTLS', $resp);

    $resp = $cmd('AUTH LOGIN');
    if ($code($resp) !== 334) return $fail('AUTH LOGIN', $resp);

    $resp = $cmd(base64_encode($user));
    if ($code($resp) !== 334) return $fail('SMTP uživatel', $resp);

    $resp = $cmd(base64_encode($pass));
    if ($code($resp) !== 235) return $fail('SMTP heslo', $resp);

    $resp = $cmd("MAIL FROM:<$user>");
    if ($code($resp) !== 250) return $fail('MAIL FROM', $resp);

    foreach (array_filter(array_map('trim', explode(',', $to))) as $rcpt) {
        $resp = $cmd("RCPT TO:<$rcpt>");
        if ($code($resp) !== 250 && $code($resp) !== 251) {
            logError("smtpSend: RCPT TO $rcpt odmítnuto: " . trim($resp));
        }
    }

    $resp = $cmd('DATA');
    if ($code($resp) !== 354) return $fail('DATA', $resp);

    // Dot-stuffing: řádek začínající tečkou by SMTP server pochopil jako konec zprávy.
    $escaped = preg_replace('/^\./m', '..', $rawMessage);
    fwrite($sock, $escaped . "\r\n.\r\n");
    $resp = $readResponse();
    $success = $code($resp) === 250;
    if (!$success) logError('smtpSend: odeslání zprávy selhalo: ' . trim($resp));

    fwrite($sock, "QUIT\r\n");
    fclose($sock);
    return $success;
}

function sendMail(array $config, string $to, string $subject, string $body): void
{
    $from    = $config['mail_from'] ?? 'noreply@bloodandguts.cz';
    $orgName = $config['org_name']  ?? 'BloodAndGuts';
    $subjectEncoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = implode("\r\n", [
        "From: $orgName <$from>",
        "To: $to",
        "Subject: $subjectEncoded",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
    ]);
    $encoded = chunk_split(base64_encode($body));
    smtpSend($config, $to, $headers . "\r\n\r\n" . $encoded);
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
