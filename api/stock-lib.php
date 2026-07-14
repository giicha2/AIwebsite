<?php
require_once __DIR__ . "/blog-auth-lib.php";

function httpGetJson($url, $timeout = 14)
{
    $headers = [
        "Accept: application/json,text/plain,*/*",
        "Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    ];
    $ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    if (function_exists("curl_init")) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_USERAGENT => $ua,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_ENCODING => "",
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
            "header" => "User-Agent: {$ua}\r\n" . implode("\r\n", $headers) . "\r\n",
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
    $raw = preg_replace('/[^\d.]/', '', (string) $value);
    if ($raw === "" || $raw === null) {
        return 0.0;
    }
    return (float) $raw;
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

        if ($preferred) {
            return $preferred;
        }
    }

    return null;
}

/**
 * Resolve a user-entered name or ticker into a Yahoo/Naver symbol.
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
        || preg_match('/^[A-Z0-9]{1,5}\.(KS|KQ)$/', $normalized)
    ) {
        return $normalized;
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

function fetchNaverKrQuote($symbol)
{
    if (preg_match('/^(\d{6})\.(KS|KQ)$/', strtoupper((string) $symbol), $m)) {
        $code = $m[1];
        $suffix = $m[2];
    } elseif (preg_match('/^(\d{6})$/', (string) $symbol, $m2)) {
        $code = $m2[1];
        $suffix = "KS";
    } else {
        return null;
    }

    $url = "https://m.stock.naver.com/api/stock/{$code}/basic";
    $data = httpGetJson($url);

    if (!is_array($data)) {
        return null;
    }

    $close = parseKrwNumber($data["closePrice"] ?? 0);
    if (!($close > 0)) {
        return null;
    }

    $change = parseKrwNumber($data["compareToPreviousClosePrice"] ?? 0);
    $prevClose = $close - $change;
    if (!($prevClose > 0)) {
        $prevClose = $close;
    }

    $price = $prevClose > 0 ? $prevClose : $close;

    return [
        "symbol" => $code . "." . $suffix,
        "currency" => "KRW",
        "exchange" => (string) ($data["stockExchangeName"] ?? "KRX"),
        "price" => $price,
        "previousClose" => $prevClose,
        "regularMarketPrice" => $close,
        "shortName" => (string) ($data["stockName"] ?? ""),
        "source" => "naver",
    ];
}

function fetchUsdKrwQuote()
{
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

    if ($symbol === "") {
        return null;
    }

    // Korean tickers: Naver first (more reliable from KR NAS), Yahoo second.
    if (preg_match('/^\d{6}\.(KS|KQ)$/', $symbol)) {
        $naver = fetchNaverKrQuote($symbol);
        if ($naver && $naver["price"] > 0) {
            return [
                "symbol" => $naver["symbol"],
                "ok" => true,
                "currency" => "KRW",
                "exchange" => $naver["exchange"],
                "price" => $naver["price"],
                "previousClose" => $naver["previousClose"],
                "name" => $naver["shortName"],
                "source" => "naver",
            ];
        }
    }

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
        "error" => "시세를 가져오지 못했습니다. (Yahoo/Naver 응답 없음)",
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
