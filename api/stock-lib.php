<?php
require_once __DIR__ . "/blog-auth-lib.php";

function httpGetJson($url, $timeout = 12)
{
    if (function_exists("curl_init")) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_USERAGENT => "Mozilla/5.0 (compatible; MyWebsitePortfolio/1.0)",
            CURLOPT_HTTPHEADER => ["Accept: application/json"],
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false || $code >= 400) {
            return null;
        }

        $data = json_decode($body, true);
        return is_array($data) ? $data : null;
    }

    $context = stream_context_create([
        "http" => [
            "method" => "GET",
            "timeout" => $timeout,
            "header" => "User-Agent: Mozilla/5.0 (compatible; MyWebsitePortfolio/1.0)\r\nAccept: application/json\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);

    if ($body === false) {
        return null;
    }

    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

function normalizeStockSymbol($symbol)
{
    $symbol = strtoupper(trim((string) $symbol));
    $symbol = str_replace(" ", "", $symbol);

    if ($symbol === "") {
        return "";
    }

    // Samsung Electronics common aliases
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

    // Yahoo tickers: AAPL, BRK-B, ^GSPC, 005930.KS already handled
    return (bool) preg_match('/^[A-Z0-9][A-Z0-9.\-^]{0,14}$/', $symbol);
}

function yahooSearchSymbol($query)
{
    $query = trim((string) $query);

    if ($query === "") {
        return null;
    }

    $url = "https://query1.finance.yahoo.com/v1/finance/search?"
        . http_build_query([
            "q" => $query,
            "quotesCount" => 8,
            "newsCount" => 0,
            "listsCount" => 0,
        ]);

    $data = httpGetJson($url);

    if (!$data || empty($data["quotes"]) || !is_array($data["quotes"])) {
        return null;
    }

    $preferred = null;

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

        if ($preferred === null) {
            $preferred = normalizeStockSymbol($symbol);
        }
    }

    return $preferred;
}

/**
 * Resolve a user-entered name or ticker into a Yahoo symbol.
 * Accepts "테슬라", "TSLA", "005930", "삼성전자" etc.
 */
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

    // Direct alias (Korean keys as-is + uppercased latin)
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

    if (looksLikeTickerSymbol($normalized)) {
        // Prefer verifying known aliases already applied by normalize
        $probe = fetchStockQuote($normalized);
        if ($probe && !empty($probe["ok"])) {
            return $normalized;
        }
        // Still return ticker-like input; caller may accept cost fallback
        if (preg_match('/^\d{6}\.(KS|KQ)$/', $normalized) || preg_match('/^[A-Z]{1,5}(-[A-Z])?$/', $normalized)) {
            return $normalized;
        }
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
    $symbol = rawurlencode($symbol);
    $range = rawurlencode($range);
    $interval = rawurlencode($interval);
    $url = "https://query1.finance.yahoo.com/v8/finance/chart/{$symbol}?range={$range}&interval={$interval}";

    return httpGetJson($url);
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
    ];
}

function fetchUsdKrwRate()
{
    $chart = fetchYahooChart("KRW=X", "5d", "1d");
    $quote = $chart ? extractQuoteFromChart($chart) : null;

    if ($quote && $quote["price"] > 0) {
        return (float) $quote["price"];
    }

    return 1350.0;
}

function fetchStockQuote($symbol)
{
    $symbol = normalizeStockSymbol($symbol);

    if ($symbol === "") {
        return null;
    }

    $chart = fetchYahooChart($symbol, "5d", "1d");
    $quote = $chart ? extractQuoteFromChart($chart) : null;

    if (!$quote || !($quote["price"] > 0)) {
        return [
            "symbol" => $symbol,
            "ok" => false,
            "error" => "시세를 가져오지 못했습니다.",
        ];
    }

    return [
        "symbol" => $quote["symbol"] !== "" ? $quote["symbol"] : $symbol,
        "ok" => true,
        "currency" => $quote["currency"],
        "exchange" => $quote["exchange"],
        "price" => $quote["price"],
        "previousClose" => $quote["previousClose"],
        "name" => $quote["shortName"],
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
