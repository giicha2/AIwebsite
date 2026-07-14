<?php
require_once __DIR__ . "/blog-auth-lib.php";

$GLOBALS["HTTP_LAST_ERROR"] = "";

function httpLastError()
{
    return (string) ($GLOBALS["HTTP_LAST_ERROR"] ?? "");
}

function httpGetJson($url, $timeout = 12)
{
    $GLOBALS["HTTP_LAST_ERROR"] = "";
    $ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    $headerLines = [
        "Accept: application/json,text/plain,*/*",
        "Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer: https://m.stock.naver.com/",
    ];

    $errors = [];

    if (function_exists("curl_init")) {
        foreach ([true, false] as $verifySsl) {
            $ch = curl_init($url);
            $opts = [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_CONNECTTIMEOUT => $timeout,
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_USERAGENT => $ua,
                CURLOPT_HTTPHEADER => $headerLines,
                CURLOPT_SSL_VERIFYPEER => $verifySsl,
                CURLOPT_SSL_VERIFYHOST => $verifySsl ? 2 : 0,
                CURLOPT_ENCODING => "",
            ];
            if (defined("CURL_IPRESOLVE_V4")) {
                $opts[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V4;
            }
            // Common Synology CA bundle locations
            foreach ([
                "/etc/ssl/certs/ca-certificates.crt",
                "/etc/ssl/cert.pem",
                "/usr/share/ssl/certs/ca-bundle.crt",
                "/usr/syno/etc/ssl/certs.pem",
            ] as $ca) {
                if ($verifySsl && is_readable($ca)) {
                    $opts[CURLOPT_CAINFO] = $ca;
                    break;
                }
            }
            curl_setopt_array($ch, $opts);
            $body = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $errno = curl_errno($ch);
            $err = curl_error($ch);
            curl_close($ch);

            if ($body !== false && $code > 0 && $code < 400) {
                $data = json_decode($body, true);
                if (is_array($data)) {
                    return $data;
                }
                $errors[] = "SSL=" . ($verifySsl ? "1" : "0") . " HTTP{$code} JSON decode failed";
            } else {
                $errors[] = "SSL=" . ($verifySsl ? "1" : "0")
                    . " HTTP{$code} errno={$errno} err=" . ($err !== "" ? $err : "empty");
            }
        }
    } else {
        $errors[] = "curl_init unavailable";
    }

    if (ini_get("allow_url_fopen")) {
        foreach ([true, false] as $verifySsl) {
            $context = stream_context_create([
                "http" => [
                    "method" => "GET",
                    "timeout" => $timeout,
                    "header" => "User-Agent: {$ua}\r\n" . implode("\r\n", $headerLines) . "\r\n",
                ],
                "ssl" => [
                    "verify_peer" => $verifySsl,
                    "verify_peer_name" => $verifySsl,
                ],
            ]);
            $body = @file_get_contents($url, false, $context);
            if ($body === false) {
                $errors[] = "fopen SSL=" . ($verifySsl ? "1" : "0") . " failed";
                continue;
            }
            $data = json_decode($body, true);
            if (is_array($data)) {
                return $data;
            }
            $errors[] = "fopen SSL=" . ($verifySsl ? "1" : "0") . " JSON decode failed";
        }
    } else {
        $errors[] = "allow_url_fopen=0";
    }

    // Synology Web Station PHP often ships without curl/openssl extensions.
    // Fall back to the system curl binary when available.
    $curlBin = null;
    foreach (["/usr/bin/curl", "/bin/curl", "curl"] as $candidate) {
        if ($candidate === "curl") {
            if (function_exists("shell_exec")) {
                $which = @shell_exec("command -v curl 2>/dev/null");
                if (is_string($which) && trim($which) !== "") {
                    $curlBin = trim($which);
                }
            }
            break;
        }
        if (is_executable($candidate)) {
            $curlBin = $candidate;
            break;
        }
    }

    if ($curlBin && function_exists("shell_exec") && !preg_match('/[;&|`$<>]/', $url)) {
        $cmd = escapeshellarg($curlBin)
            . " -sS -L --max-time " . (int) $timeout
            . " -A " . escapeshellarg($ua)
            . " -H " . escapeshellarg("Accept: application/json,text/plain,*/*")
            . " -H " . escapeshellarg("Accept-Language: ko-KR,ko;q=0.9,en;q=0.8")
            . " -H " . escapeshellarg("Referer: https://m.stock.naver.com/")
            . " --compressed "
            . escapeshellarg($url)
            . " 2>&1";
        $body = @shell_exec($cmd);
        if (is_string($body) && $body !== "") {
            $data = json_decode($body, true);
            if (is_array($data)) {
                return $data;
            }
            $errors[] = "bin-curl non-json: " . substr(trim($body), 0, 120);
        } else {
            $errors[] = "bin-curl empty/fail";
        }
    } else {
        $errors[] = $curlBin ? "shell_exec unavailable" : "system curl not found";
    }

    $GLOBALS["HTTP_LAST_ERROR"] = implode(" | ", $errors);
    return null;
}

function httpProbeUrl($url)
{
    $started = microtime(true);
    $data = httpGetJson($url, 8);
    return [
        "url" => $url,
        "ok" => is_array($data),
        "ms" => (int) round((microtime(true) - $started) * 1000),
        "error" => is_array($data) ? "" : httpLastError(),
        "keys" => is_array($data) ? array_slice(array_keys($data), 0, 8) : [],
    ];
}

function httpProbeReport()
{
    $curlVersion = function_exists("curl_version") ? curl_version() : null;
    $curlBin = null;
    foreach (["/usr/bin/curl", "/bin/curl"] as $candidate) {
        if (is_executable($candidate)) {
            $curlBin = $candidate;
            break;
        }
    }

    return [
        "php" => PHP_VERSION,
        "curl" => function_exists("curl_init"),
        "curlSsl" => is_array($curlVersion) ? !empty($curlVersion["features"]) && ((int) $curlVersion["features"] & (defined("CURL_VERSION_SSL") ? CURL_VERSION_SSL : 0)) : null,
        "curlVersion" => is_array($curlVersion) ? ($curlVersion["version"] ?? null) : null,
        "systemCurl" => $curlBin,
        "shellExec" => function_exists("shell_exec") && !in_array("shell_exec", array_map("trim", explode(",", (string) ini_get("disable_functions"))), true),
        "allowUrlFopen" => (bool) ini_get("allow_url_fopen"),
        "openssl" => extension_loaded("openssl"),
        "probes" => [
            httpProbeUrl("https://m.stock.naver.com/api/stock/005930/basic"),
            httpProbeUrl("https://api.stock.naver.com/stock/TSLA.O/basic"),
            httpProbeUrl("https://open.er-api.com/v6/latest/USD"),
            httpProbeUrl("https://query1.finance.yahoo.com/v8/finance/chart/TSLA?range=5d&interval=1d"),
        ],
    ];
}

function normalizeStockSymbol($symbol)
{
    $symbol = strtoupper(trim((string) $symbol));
    $symbol = str_replace(" ", "", $symbol);

    if ($symbol === "") {
        return "";
    }

    if (in_array($symbol, ["삼성전자", "SAMSUNG", "005930"], true)) {
        return "005930.KS";
    }

    if (preg_match('/^\d{6}$/', $symbol)) {
        return $symbol . ".KS";
    }

    return $symbol;
}

function stockAliasMap()
{
    return [
        "테슬라" => "TSLA",
        "TESLA" => "TSLA",
        "애플" => "AAPL",
        "APPLE" => "AAPL",
        "엔비디아" => "NVDA",
        "NVIDIA" => "NVDA",
        "마이크로소프트" => "MSFT",
        "MICROSOFT" => "MSFT",
        "아마존" => "AMZN",
        "AMAZON" => "AMZN",
        "구글" => "GOOGL",
        "알파벳" => "GOOGL",
        "GOOGLE" => "GOOGL",
        "ALPHABET" => "GOOGL",
        "메타" => "META",
        "페이스북" => "META",
        "META" => "META",
        "넷플릭스" => "NFLX",
        "NETFLIX" => "NFLX",
        "삼성전자" => "005930.KS",
        "SAMSUNG" => "005930.KS",
        "SK하이닉스" => "000660.KS",
        "하이닉스" => "000660.KS",
        "네이버" => "035420.KS",
        "NAVER" => "035420.KS",
        "카카오" => "035720.KS",
        "KAKAO" => "035720.KS",
        "현대차" => "005380.KS",
        "현대자동차" => "005380.KS",
        "LG에너지솔루션" => "373220.KS",
        "기아" => "000270.KS",
    ];
}

function looksLikeTickerSymbol($symbol)
{
    $symbol = normalizeStockSymbol($symbol);

    if ($symbol === "") {
        return false;
    }

    if (preg_match('/^\d{6}\.(KS|KQ)$/', $symbol)) {
        return true;
    }

    return (bool) preg_match('/^[A-Z0-9][A-Z0-9.\-^]{0,14}$/', $symbol);
}

function parseKrwNumber($value)
{
    $raw = preg_replace('/[^\d.\-]/', '', (string) $value);
    if ($raw === "" || $raw === null) {
        return 0.0;
    }
    return (float) $raw;
}

function naverSearchStock($query)
{
    $query = trim((string) $query);
    if ($query === "") {
        return null;
    }

    $url = "https://m.stock.naver.com/front-api/search/autoComplete?"
        . http_build_query([
            "query" => $query,
            "target" => "stock",
        ]);

    $data = httpGetJson($url);
    $items = $data["result"]["items"] ?? null;

    if (!is_array($items) || count($items) === 0) {
        return null;
    }

    $first = $items[0];
    $code = (string) ($first["code"] ?? "");
    $reuters = (string) ($first["reutersCode"] ?? $code);
    $nation = strtoupper((string) ($first["nationCode"] ?? ""));
    $name = (string) ($first["name"] ?? $code);

    if ($reuters === "") {
        return null;
    }

    if ($nation === "KOR" || preg_match('/^\d{6}$/', $code)) {
        return [
            "symbol" => normalizeStockSymbol($code),
            "reutersCode" => $code,
            "market" => "domestic",
            "name" => $name,
        ];
    }

    return [
        "symbol" => strtoupper($code !== "" ? $code : preg_replace('/\..*$/', "", $reuters)),
        "reutersCode" => $reuters,
        "market" => "world",
        "name" => $name,
    ];
}

function yahooSearchSymbol($query)
{
    $query = trim((string) $query);

    if ($query === "") {
        return null;
    }

    foreach (["query1", "query2"] as $host) {
        $url = "https://{$host}.finance.yahoo.com/v1/finance/search?"
            . http_build_query([
                "q" => $query,
                "quotesCount" => 8,
                "newsCount" => 0,
                "listsCount" => 0,
            ]);

        $data = httpGetJson($url);

        if (!$data || empty($data["quotes"]) || !is_array($data["quotes"])) {
            continue;
        }

        foreach ($data["quotes"] as $quote) {
            if (!is_array($quote)) {
                continue;
            }

            $type = strtoupper((string) ($quote["quoteType"] ?? ""));
            $symbol = trim((string) ($quote["symbol"] ?? ""));

            if ($symbol === "" || in_array($type, ["OPTION", "FUTURE", "CURRENCY", "CRYPTOCURRENCY"], true)) {
                continue;
            }

            if ($type === "EQUITY" || $type === "ETF") {
                return normalizeStockSymbol($symbol);
            }
        }
    }

    return null;
}

function resolveStockSymbolFromQuery($query)
{
    $query = trim((string) $query);

    if ($query === "") {
        return "";
    }

    $aliases = stockAliasMap();
    $aliasKey = function_exists("mb_strtoupper")
        ? mb_strtoupper($query, "UTF-8")
        : strtoupper($query);

    if (isset($aliases[$query])) {
        return normalizeStockSymbol($aliases[$query]);
    }

    foreach ($aliases as $key => $symbol) {
        $keyUpper = function_exists("mb_strtoupper")
            ? mb_strtoupper($key, "UTF-8")
            : strtoupper($key);
        if ($keyUpper === $aliasKey) {
            return normalizeStockSymbol($symbol);
        }
    }

    $normalized = normalizeStockSymbol($query);

    if (
        preg_match('/^\d{6}\.(KS|KQ)$/', $normalized)
        || preg_match('/^[A-Z]{1,5}(-[A-Z])?$/', $normalized)
    ) {
        return $normalized;
    }

    $naver = naverSearchStock($query);
    if ($naver && !empty($naver["symbol"])) {
        return normalizeStockSymbol($naver["symbol"]);
    }

    $searched = yahooSearchSymbol($query);
    if ($searched) {
        return $searched;
    }

    if ($normalized !== "" && looksLikeTickerSymbol($normalized)) {
        return $normalized;
    }

    return "";
}

function fetchYahooChart($symbol, $range = "5d", $interval = "1d")
{
    $encoded = rawurlencode($symbol);
    $range = rawurlencode($range);
    $interval = rawurlencode($interval);

    foreach (["query1", "query2"] as $host) {
        $url = "https://{$host}.finance.yahoo.com/v8/finance/chart/{$encoded}?range={$range}&interval={$interval}";
        $data = httpGetJson($url);
        if (is_array($data) && !empty($data["chart"]["result"][0])) {
            return $data;
        }
    }

    return null;
}

function extractQuoteFromChart($chart)
{
    $result = $chart["chart"]["result"][0] ?? null;

    if (!is_array($result)) {
        return null;
    }

    $meta = $result["meta"] ?? [];
    $closes = $result["indicators"]["quote"][0]["close"] ?? [];
    $timestamps = $result["timestamp"] ?? [];

    $prevClose = null;

    if (isset($meta["chartPreviousClose"])) {
        $prevClose = (float) $meta["chartPreviousClose"];
    } elseif (isset($meta["previousClose"])) {
        $prevClose = (float) $meta["previousClose"];
    }

    $lastClose = null;

    for ($i = count($closes) - 1; $i >= 0; $i--) {
        if ($closes[$i] !== null) {
            $lastClose = (float) $closes[$i];
            break;
        }
    }

    if ($prevClose === null && count($closes) >= 2) {
        for ($i = count($closes) - 2; $i >= 0; $i--) {
            if ($closes[$i] !== null) {
                $prevClose = (float) $closes[$i];
                break;
            }
        }
    }

    $price = $prevClose !== null ? $prevClose : $lastClose;

    return [
        "symbol" => (string) ($meta["symbol"] ?? ""),
        "currency" => (string) ($meta["currency"] ?? "USD"),
        "exchange" => (string) ($meta["exchangeName"] ?? ""),
        "price" => $price,
        "previousClose" => $prevClose,
        "regularMarketPrice" => isset($meta["regularMarketPrice"])
            ? (float) $meta["regularMarketPrice"]
            : $lastClose,
        "shortName" => (string) ($meta["shortName"] ?? $meta["longName"] ?? ""),
        "timestamps" => $timestamps,
        "closes" => $closes,
        "source" => "yahoo",
    ];
}

function fetchNaverDomesticQuote($code)
{
    $code = preg_replace('/\D/', '', (string) $code);
    if (!preg_match('/^\d{6}$/', $code)) {
        return null;
    }

    // Prefer mobile basic API.
    $data = httpGetJson("https://m.stock.naver.com/api/stock/{$code}/basic");
    if (is_array($data)) {
        $close = parseKrwNumber($data["closePrice"] ?? 0);
        if ($close > 0) {
            $change = parseKrwNumber($data["compareToPreviousClosePrice"] ?? 0);
            $prevClose = $close - $change;
            if (!($prevClose > 0)) {
                $prevClose = $close;
            }

            return [
                "symbol" => $code . ".KS",
                "currency" => "KRW",
                "exchange" => (string) ($data["stockExchangeName"] ?? "KRX"),
                "price" => $prevClose,
                "previousClose" => $prevClose,
                "regularMarketPrice" => $close,
                "shortName" => (string) ($data["stockName"] ?? ""),
                "source" => "naver",
            ];
        }
    }

    // Fallback: realtime polling (pcv = previous close).
    $poll = httpGetJson(
        "https://polling.finance.naver.com/api/realtime?" . http_build_query([
            "query" => "SERVICE_ITEM:" . $code,
        ])
    );
    $row = $poll["result"]["areas"][0]["datas"][0] ?? null;
    if (is_array($row)) {
        $prev = (float) ($row["pcv"] ?? 0);
        $now = (float) ($row["nv"] ?? 0);
        $price = $prev > 0 ? $prev : $now;
        if ($price > 0) {
            return [
                "symbol" => $code . ".KS",
                "currency" => "KRW",
                "exchange" => "KRX",
                "price" => $price,
                "previousClose" => $prev > 0 ? $prev : $price,
                "regularMarketPrice" => $now > 0 ? $now : $price,
                "shortName" => (string) ($row["nm"] ?? ""),
                "source" => "naver-poll",
            ];
        }
    }

    return null;
}

function fetchNaverWorldQuote($reutersCode, $fallbackSymbol = "")
{
    $reutersCode = trim((string) $reutersCode);
    if ($reutersCode === "") {
        return null;
    }

    $data = httpGetJson("https://api.stock.naver.com/stock/" . rawurlencode($reutersCode) . "/basic");
    if (!is_array($data) || isset($data["code"])) {
        return null;
    }

    $close = parseKrwNumber($data["closePrice"] ?? 0);
    if (!($close > 0)) {
        return null;
    }

    $change = parseKrwNumber($data["compareToPreviousClosePrice"] ?? 0);
    $prevClose = $close - $change;
    if (!($prevClose > 0)) {
        // Prefer explicit basePrice (전일) from infos when present.
        foreach (($data["stockItemTotalInfos"] ?? []) as $info) {
            if (($info["code"] ?? "") === "basePrice") {
                $base = parseKrwNumber($info["value"] ?? 0);
                if ($base > 0) {
                    $prevClose = $base;
                }
                break;
            }
        }
    }
    if (!($prevClose > 0)) {
        $prevClose = $close;
    }

    $currency = strtoupper((string) ($data["currencyType"]["code"] ?? $data["currencyType"]["name"] ?? "USD"));
    $symbol = strtoupper((string) ($data["symbolCode"] ?? $fallbackSymbol));
    if ($symbol === "") {
        $symbol = strtoupper(preg_replace('/\..*$/', "", $reutersCode));
    }

    return [
        "symbol" => $symbol,
        "currency" => $currency !== "" ? $currency : "USD",
        "exchange" => (string) ($data["stockExchangeName"] ?? ""),
        "price" => $prevClose,
        "previousClose" => $prevClose,
        "regularMarketPrice" => $close,
        "shortName" => (string) ($data["stockName"] ?? $data["stockNameEng"] ?? ""),
        "source" => "naver-world",
    ];
}

function guessNaverWorldCodes($symbol)
{
    $symbol = strtoupper(trim((string) $symbol));
    if ($symbol === "" || preg_match('/^\d{6}/', $symbol)) {
        return [];
    }

    // Common Yahoo → Naver reuters suffixes.
    $guesses = [$symbol . ".O", $symbol . ".N", $symbol . ".K", $symbol];

    $map = [
        "TSLA" => ["TSLA.O"],
        "AAPL" => ["AAPL.O"],
        "MSFT" => ["MSFT.O"],
        "AMZN" => ["AMZN.O"],
        "GOOGL" => ["GOOGL.O"],
        "GOOG" => ["GOOG.O"],
        "META" => ["META.O"],
        "NVDA" => ["NVDA.O"],
        "NFLX" => ["NFLX.O"],
        "BRK-B" => ["BRK_B.N", "BRK-B.N"],
    ];

    if (isset($map[$symbol])) {
        $guesses = array_merge($map[$symbol], $guesses);
    }

    return array_values(array_unique($guesses));
}

function fetchUsdKrwQuote()
{
    // Prefer Naver FX page APIs are unstable; try Yahoo then open.er-api.
    $chart = fetchYahooChart("KRW=X", "5d", "1d");
    $quote = $chart ? extractQuoteFromChart($chart) : null;

    if ($quote && $quote["price"] > 0) {
        return [
            "rate" => (float) $quote["price"],
            "source" => "yahoo",
        ];
    }

    $data = httpGetJson("https://open.er-api.com/v6/latest/USD");
    if (is_array($data) && isset($data["rates"]["KRW"]) && (float) $data["rates"]["KRW"] > 0) {
        return [
            "rate" => (float) $data["rates"]["KRW"],
            "source" => "exchangerate-api",
        ];
    }

    return [
        "rate" => 1490.0,
        "source" => "fallback",
    ];
}

function fetchUsdKrwRate()
{
    return fetchUsdKrwQuote()["rate"];
}

function fetchStockQuote($symbol)
{
    $symbol = normalizeStockSymbol($symbol);
    $attempts = [];

    if ($symbol === "") {
        return null;
    }

    // 1) Korean domestic via Naver
    if (preg_match('/^(\d{6})\.(KS|KQ)$/', $symbol, $m)) {
        $naver = fetchNaverDomesticQuote($m[1]);
        $attempts[] = "naver-domestic";
        if ($naver && $naver["price"] > 0) {
            return [
                "symbol" => $naver["symbol"],
                "ok" => true,
                "currency" => "KRW",
                "exchange" => $naver["exchange"],
                "price" => $naver["price"],
                "previousClose" => $naver["previousClose"],
                "name" => $naver["shortName"],
                "source" => $naver["source"],
            ];
        }
    }

    // 2) Overseas / ticker via Naver world API
    $worldCodes = guessNaverWorldCodes($symbol);
    $searched = naverSearchStock($symbol);
    if ($searched && ($searched["market"] ?? "") === "world" && !empty($searched["reutersCode"])) {
        array_unshift($worldCodes, $searched["reutersCode"]);
        $worldCodes = array_values(array_unique($worldCodes));
    }

    foreach ($worldCodes as $code) {
        $attempts[] = "naver-world:" . $code;
        $world = fetchNaverWorldQuote($code, $symbol);
        if ($world && $world["price"] > 0) {
            return [
                "symbol" => $world["symbol"] !== "" ? $world["symbol"] : $symbol,
                "ok" => true,
                "currency" => $world["currency"],
                "exchange" => $world["exchange"],
                "price" => $world["price"],
                "previousClose" => $world["previousClose"],
                "name" => $world["shortName"],
                "source" => $world["source"],
            ];
        }
    }

    // 3) Yahoo last resort
    $attempts[] = "yahoo";
    $chart = fetchYahooChart($symbol, "5d", "1d");
    $quote = $chart ? extractQuoteFromChart($chart) : null;

    if ($quote && $quote["price"] > 0) {
        return [
            "symbol" => $quote["symbol"] !== "" ? $quote["symbol"] : $symbol,
            "ok" => true,
            "currency" => $quote["currency"],
            "exchange" => $quote["exchange"],
            "price" => $quote["price"],
            "previousClose" => $quote["previousClose"],
            "name" => $quote["shortName"],
            "source" => "yahoo",
        ];
    }

    return [
        "symbol" => $symbol,
        "ok" => false,
        "error" => "시세를 가져오지 못했습니다. NAS에서 외부시세 서버에 연결되지 않습니다.",
        "detail" => httpLastError(),
        "attempts" => $attempts,
    ];
}

function fetchStockHistory($symbol, $range = "1mo")
{
    $symbol = normalizeStockSymbol($symbol);

    if ($symbol === "") {
        return [];
    }

    $chart = fetchYahooChart($symbol, $range, "1d");
    $quote = $chart ? extractQuoteFromChart($chart) : null;

    if (!$quote) {
        return [];
    }

    $points = [];
    $timestamps = $quote["timestamps"];
    $closes = $quote["closes"];

    foreach ($timestamps as $i => $ts) {
        if (!isset($closes[$i]) || $closes[$i] === null) {
            continue;
        }

        $points[] = [
            "date" => gmdate("Y-m-d", (int) $ts),
            "close" => (float) $closes[$i],
        ];
    }

    return $points;
}
