<?php
/**
 * PHP built-in server router.
 * Použití: php -S localhost:8310 -t php-forpsi/public php-forpsi/public/router.php
 *
 * Přeposílá /api/* → api/index.php se správnou cestou k src/.
 */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (preg_match('/^\/api(\/|$)/', $uri)) {
    define('BG_LOCAL_SRC_DIR', realpath(__DIR__ . '/../src'));
    require __DIR__ . '/api/index.php';
    return true;
}

// Statický soubor (assets, index.html…)
return false;
