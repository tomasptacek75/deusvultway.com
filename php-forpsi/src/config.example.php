<?php
declare(strict_types=1);

// Šablona pro config.php (ten je gitignorovaný, obsahuje reálný JWT secret).
// Zkopíruj tenhle soubor na config.php a doplň skutečné hodnoty.

return [
    'jwt_secret' => 'CHANGE_ME',
    'db_path'    => __DIR__ . '/../data/bloodandguts.db',
    'org_name'   => 'BloodAndGuts',
];
