<?php
declare(strict_types=1);

// Šablona pro config.php (ten je gitignorovaný, obsahuje reálný JWT secret).
// Zkopíruj tenhle soubor na config.php a doplň skutečné hodnoty.

return [
    'jwt_secret' => 'CHANGE_ME',
    'db_path'    => __DIR__ . '/../data/bloodandguts.db',
    'org_name'   => 'BloodAndGuts',

    // Hlasový tréninkový deník (muj.bloodandguts.cz) — Whisper transkripce + Anthropic
    // strukturování/návrh tréninku. Na produkci/testu se nepoužívají, ale klíč musí být
    // v poli přítomný (viz ai.php), i kdyby prázdný string.
    'openai_api_key'    => 'CHANGE_ME',
    'anthropic_api_key' => 'CHANGE_ME',

    // Na muj.bloodandguts.cz nastavit na false, aby se na čerstvé DB neseedoval fake David
    // + demo klienti (viz seedDemoData()/seedExtraDemoClients() v db.php). Na produkci a
    // testu nechat true (nebo klíč vůbec nenastavovat — default je true).
    'seed_demo' => true,

    // SMTP pro reset hesla role 'diary' (viz bootstrap.php smtpSend()/sendMail() — stejný
    // vzor jako Kamata.cz). Na produkci/testu se nepoužívá.
    'smtp_host' => 'smtp.forpsi.com',
    'smtp_port' => 587,
    'smtp_user' => 'CHANGE_ME',
    'smtp_pass' => 'CHANGE_ME',
    'mail_from' => 'noreply@bloodandguts.cz',
];
