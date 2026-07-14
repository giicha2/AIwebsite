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
