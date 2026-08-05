<?php
declare(strict_types=1);

// Klienti pro externí AI služby použité hlasovým tréninkovým deníkem (muj.bloodandguts.cz).
// Raw curl, bez Composer/SDK — repo je záměrně bezzávislostní PHP (viz jwt_create/jwt_verify
// v bootstrap.php), přidávat vendor kvůli dvěma HTTP voláním by bylo neúměrné.

function anthropicMessages(array $config, array $body): array
{
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'x-api-key: ' . $config['anthropic_api_key'],
            'anthropic-version: 2023-06-01',
            'content-type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 60,
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new \RuntimeException('Anthropic API: ' . $err);
    }
    curl_close($ch);
    $data = json_decode($raw, true);
    if (!is_array($data)) throw new \RuntimeException('Anthropic API: neplatná odpověď');
    if (isset($data['error'])) throw new \RuntimeException('Anthropic API error: ' . ($data['error']['message'] ?? 'neznámá chyba'));
    return $data;
}

// claude-sonnet-5 (a případně další modely) může před textovou odpovědí vracet i "thinking"
// bloky v content[] — nelze tedy spoléhat na content[0], je nutné najít první blok type='text'.
function anthropicText(array $resp): string
{
    foreach ($resp['content'] ?? [] as $block) {
        if (($block['type'] ?? '') === 'text') return $block['text'] ?? '';
    }
    return '';
}

function whisperTranscribe(array $config, string $filePath, string $mimeType): string
{
    // CURLOPT_VERBOSE + STDERR přesměrovaný do zahazovaného streamu vypadá zbytečně, ale bez
    // něj multipart upload (CURLFile) přes `php -r` (inline skript) na Windows spadal na
    // CURLE_ABORTED_BY_CALLBACK hned po "100 Continue" — jako spuštěný .php soubor (přesně
    // takhle to reálně běží přes router.php i na produkci) to bylo spolehlivé i bez téhle
    // kombinace, ale nechávám ji jako neškodnou pojistku (ověřeno 2026-07-31).
    $verboseSink = fopen('php://temp', 'w+');

    $ch = curl_init('https://api.openai.com/v1/audio/transcriptions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $config['openai_api_key']],
        CURLOPT_POSTFIELDS => [
            'file' => new \CURLFile($filePath, $mimeType, basename($filePath)),
            'model' => 'whisper-1',
            'language' => 'cs',
            // verbose_json místo json — potřebujeme segments[].no_speech_prob, abychom poznali
            // halucinaci (viz isLikelyHallucination() níže), obyčejný 'json' vrací jen text.
            'response_format' => 'verbose_json',
        ],
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_VERBOSE => true,
        CURLOPT_STDERR => $verboseSink,
    ]);
    $raw = curl_exec($ch);
    fclose($verboseSink);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new \RuntimeException('Whisper API: ' . $err);
    }
    curl_close($ch);
    $data = json_decode($raw, true);
    if (!is_array($data)) throw new \RuntimeException('Whisper API: neplatná odpověď');
    if (isset($data['error'])) throw new \RuntimeException('Whisper API error: ' . ($data['error']['message'] ?? 'neznámá chyba'));

    $text = trim((string)($data['text'] ?? ''));
    if ($text === '' || isLikelyHallucination($data['segments'] ?? [])) {
        throw new \RuntimeException('Nahrávka nezněla srozumitelně — nerozpoznali jsme žádnou řeč. Zkus to prosím znovu, ať tě appka slyší.');
    }
    return $text;
}

// Whisper na tichu/šumu bez zřetelné řeči místo "nerozuměl jsem" často vrátí věrohodně
// vyhlížející, ale zcela vymyšlený text (typicky webové adresy nebo titulkové fráze typu
// "děkuji za sledování") — známá halucinace modelu, ne chyba appky. segments[].no_speech_prob
// (dostupné jen ve verbose_json) říká, jak moc si je model jistý, že v úseku vůbec je řeč;
// když je vysoké napříč většinou úseků, jde skoro jistě o halucinaci, ne o skutečný přepis.
function isLikelyHallucination(array $segments): bool
{
    if (empty($segments)) return true;
    $high = 0;
    foreach ($segments as $seg) {
        if (($seg['no_speech_prob'] ?? 0) > 0.6) $high++;
    }
    return ($high / count($segments)) >= 0.5;
}

// Převede syrový český přepis tréninku na strukturovaná data (cviky/série/opakování/váhy).
// $knownExercises pomáhá modelu sjednotit názvy cviků s tím, co uživatel už dřív používal.
function claudeStructureWorkout(array $config, string $transcript, array $knownExercises): array
{
    $schema = [
        'type' => 'object',
        'properties' => [
            'date' => ['type' => ['string', 'null'], 'description' => 'ISO datum YYYY-MM-DD přepočtené vzhledem k dnešnímu datu ze systémového promptu — použij i pro relativní zmínky (včera, předevčírem, v pondělí...); null jen pokud přepis žádný den vůbec nezmiňuje'],
            'exercises' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'name' => ['type' => 'string'],
                        'type' => ['type' => 'string', 'enum' => ['strength', 'cardio'], 'description' => 'strength = posilovací cvik se sériemi/opakováními/váhou; cardio = běh, kolo, veslování, plavání a podobná vytrvalostní aktivita měřená časem/vzdáleností'],
                        'sets' => [
                            'type' => 'array',
                            'description' => 'U strength jedna položka = jedna série. U cardio typicky jedna položka za celou aktivitu (nebo víc při intervalech, např. 5× 1 km).',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'set_number' => ['type' => 'integer'],
                                    'reps' => ['type' => ['integer', 'null'], 'description' => 'jen strength, jinak null'],
                                    'weight_kg' => ['type' => ['number', 'null'], 'description' => 'jen strength, jinak null'],
                                    'duration_min' => ['type' => ['number', 'null'], 'description' => 'jen cardio — délka v minutách (desetinná čísla ok, např. 32.5), jinak null'],
                                    'distance_km' => ['type' => ['number', 'null'], 'description' => 'jen cardio — vzdálenost v kilometrech, jinak null'],
                                ],
                                'required' => ['set_number', 'reps', 'weight_kg', 'duration_min', 'distance_km'],
                                'additionalProperties' => false,
                            ],
                        ],
                    ],
                    'required' => ['name', 'type', 'sets'],
                    'additionalProperties' => false,
                ],
            ],
            'notes' => ['type' => ['string', 'null']],
            'confidence' => ['type' => 'string', 'enum' => ['high', 'medium', 'low']],
        ],
        'required' => ['date', 'exercises', 'notes', 'confidence'],
        'additionalProperties' => false,
    ];
    $weekdays = [1 => 'pondělí', 2 => 'úterý', 3 => 'středa', 4 => 'čtvrtek', 5 => 'pátek', 6 => 'sobota', 7 => 'neděle'];
    $today = date('Y-m-d');
    $todayLabel = "{$weekdays[(int)date('N')]} {$today}";
    $system = 'Jsi asistent, který převádí český mluvený přepis tréninku na strukturovaná data. '
        . 'Trénink může kombinovat posilovací cviky (strength — série/opakování/váha) a vytrvalostní '
        . 'aktivity jako běh, kolo, veslování, plavání, chůze (cardio — délka v minutách a/nebo '
        . 'vzdálenost v kilometrech). Každý cvik/aktivitu zařaď do pole "type" podle toho, co to je. '
        . 'U strength vyplň reps a weight_kg, duration_min a distance_km nech null. U cardio naopak '
        . 'vyplň duration_min a/nebo distance_km (podle toho, co uživatel řekl — třeba jen čas, jen '
        . 'vzdálenost, nebo obojí) a reps/weight_kg nech null. '
        . "Dnešní datum je {$todayLabel}. Přepis může být nahraný kdykoli po tréninku, ne nutně "
        . 've stejný den — pokud uživatel zmíní, kdy cvičil (explicitně datem/dnem v týdnu, nebo '
        . 'relativně: včera, předevčírem, minulé pondělí apod.), přepočítej to na konkrétní datum '
        . 'vzhledem k dnešnímu dni výše a použij ho v poli "date". Teprve pokud přepis den vůbec '
        . 'nezmiňuje, nech "date" jako null (appka pak sama doplní dnešek jako výchozí). '
        . 'Váhy jsou v kilogramech i bez uvedení jednotky. Pokud uživatel zmíní cvik/aktivitu, která se '
        . 'podobá jedné z jeho známých, použij přesně ten stejný název (sjednocení historie). '
        . 'Známé cviky uživatele: ' . (implode(', ', $knownExercises) ?: '(zatím žádné)') . '. '
        . 'confidence nastav na "low", pokud přepisu nerozumíš nebo chybí klíčové údaje.';
    $resp = anthropicMessages($config, [
        'model' => 'claude-haiku-4-5',
        'max_tokens' => 2000,
        'system' => $system,
        'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]],
        'messages' => [['role' => 'user', 'content' => $transcript]],
    ]);
    $parsed = json_decode(anthropicText($resp) ?: '{}', true);
    return is_array($parsed) ? $parsed : [];
}

// Navrhne další trénink podle cíle uživatele (síla/objem/mix) a jeho zalogované historie.
// $history je pole řádků [recorded_at, exercise_name, set_number, reps, weight_kg].
function claudeSuggestNextWorkout(array $config, string $goal, array $history, ?string $note = null): array
{
    $schema = [
        'type' => 'object',
        'properties' => [
            'summary' => ['type' => 'string', 'description' => 'Krátké shrnutí doporučení v češtině'],
            'suggested_timing' => ['type' => 'string', 'description' => 'Kdy příště trénovat, např. "za 1-2 dny" nebo "zítra"'],
            'suggested_exercises' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'name' => ['type' => 'string'],
                        'sets' => ['type' => 'integer'],
                        'reps' => ['type' => 'string', 'description' => 'např. "5" nebo "8-10"'],
                        'target_weight_kg' => ['type' => ['number', 'null']],
                        'reason' => ['type' => 'string', 'description' => 'Krátké zdůvodnění vzhledem k historii a cíli'],
                    ],
                    'required' => ['name', 'sets', 'reps', 'target_weight_kg', 'reason'],
                    'additionalProperties' => false,
                ],
            ],
        ],
        'required' => ['summary', 'suggested_timing', 'suggested_exercises'],
        'additionalProperties' => false,
    ];
    $goalLabel = ['sila' => 'síla (nízké opakování, vysoká váha)', 'objem' => 'objem/hypertrofie (vyšší opakování, kratší odpočinek)', 'mix' => 'mix síly a objemu'][$goal] ?? 'mix síly a objemu';
    $system = 'Jsi zkušený silový trenér. Na základě zalogované historie tréninků a cíle uživatele navrhni '
        . "další trénink. Cíl uživatele: {$goalLabel}. Řiď se rozumnou progresí (postupné navyšování váhy/objemu) "
        . 'a rozumným rozložením partií vzhledem k tomu, co bylo cvičeno naposledy. Odpovídej v češtině.';
    if ($note) {
        // Jednorázová poznámka k aktuálnímu stavu (bolest, zranění, únava, "chci jít dnes"...),
        // ne trvalá součást cíle — má přednost před obvyklou progresí (např. vynechat/nahradit
        // cvik na bolavou partii, navrhnout lehčí trénink, zohlednit časový tlak).
        $system .= " Uživatel navíc uvedl poznámku k tomu, jak se dnes cítí nebo co je potřeba zohlednit: "
            . "\"{$note}\". Tuhle poznámku zohledni při návrhu přednostně před obvyklou progresí "
            . '(např. vynech/nahraď cvik na bolavou/zraněnou partii, uprav intenzitu, zohledni časové omezení).';
    }
    $resp = anthropicMessages($config, [
        'model' => 'claude-sonnet-5',
        // Vyšší než u claudeStructureWorkout — sonnet-5 před textovou odpovědí typicky
        // spotřebuje pár desítek až stovek tokenů na "thinking" blok, který se počítá
        // do stejného max_tokens rozpočtu (viz anthropicText()).
        'max_tokens' => 4000,
        'system' => $system,
        'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]],
        'messages' => [['role' => 'user', 'content' => json_encode(['goal' => $goal, 'history' => $history, 'note' => $note], JSON_UNESCAPED_UNICODE)]],
    ]);
    $parsed = json_decode(anthropicText($resp) ?: '{}', true);
    return is_array($parsed) ? $parsed : [];
}
