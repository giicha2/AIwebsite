<?php
require_once __DIR__ . "/blog-auth-lib.php";
require_once __DIR__ . "/stock-lib.php";

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

function portfolioFile()
{
    return resolveWritableDir() . "/portfolio.json";
}

function defaultPortfolio()
{
    return [
        "holdings" => [
            [
                "id" => "demo-tsla",
                "name" => "테슬라",
                "symbol" => "TSLA",
                "shares" => 3,
                "costKrw" => 0,
                "created" => time(),
            ],
            [
                "id" => "demo-samsung",
                "name" => "삼성전자",
                "symbol" => "005930.KS",
                "shares" => 100,
                "costKrw" => 0,
                "created" => time(),
            ],
            [
                "id" => "demo-cash",
                "name" => "나머지(현금/기타)",
                "symbol" => "CASH",
                "shares" => 1,
                "costKrw" => 4000000,
                "priceKrw" => 4000000,
                "created" => time(),
            ],
        ],
        "history" => [],
        "updatedAt" => time(),
    ];
}

function loadPortfolio()
{
    $file = portfolioFile();

    if (!file_exists($file)) {
        $data = defaultPortfolio();
        writeJsonFile($file, $data);
        return $data;
    }

    $data = readJsonFile($file, null);

    if (!is_array($data) || !isset($data["holdings"]) || !is_array($data["holdings"])) {
        $data = defaultPortfolio();
        writeJsonFile($file, $data);
    }

    if (!isset($data["history"]) || !is_array($data["history"])) {
        $data["history"] = [];
    }

    return $data;
}

function savePortfolio($data)
{
    $data["updatedAt"] = time();
    return writeJsonFile(portfolioFile(), $data);
}

function isCashSymbol($symbol)
{
    $symbol = strtoupper(trim((string) $symbol));
    return in_array($symbol, ["CASH", "현금", "기타", "REST", "OTHER"], true);
}

function enrichHoldings($holdings, $usdKrw)
{
    $rows = [];
    $totalKrw = 0.0;

    foreach ($holdings as $holding) {
        if (!is_array($holding)) {
            continue;
        }

        $symbol = normalizeStockSymbol($holding["symbol"] ?? "");
        $shares = (float) ($holding["shares"] ?? 0);
        $name = (string) ($holding["name"] ?? $symbol);
        $costKrw = (float) ($holding["costKrw"] ?? 0);
        $row = [
            "id" => (string) ($holding["id"] ?? ""),
            "name" => $name,
            "symbol" => $symbol !== "" ? $symbol : (string) ($holding["symbol"] ?? ""),
            "shares" => $shares,
            "costKrw" => $costKrw,
            "created" => (int) ($holding["created"] ?? 0),
            "currency" => "KRW",
            "price" => null,
            "priceKrw" => null,
            "valueKrw" => 0.0,
            "quoteOk" => false,
            "quoteError" => "",
        ];

        if (isCashSymbol($row["symbol"]) || $row["symbol"] === "") {
            $cashValue = isset($holding["priceKrw"])
                ? (float) $holding["priceKrw"]
                : ($costKrw > 0 ? $costKrw : $shares);
            $row["symbol"] = "CASH";
            $row["currency"] = "KRW";
            $row["price"] = $cashValue;
            $row["priceKrw"] = $cashValue;
            $row["valueKrw"] = $cashValue;
            $row["quoteOk"] = true;
        } else {
            $quote = fetchStockQuote($row["symbol"]);

            if ($quote && !empty($quote["ok"])) {
                $price = (float) $quote["price"];
                $currency = strtoupper((string) $quote["currency"]);
                $priceKrw = $currency === "KRW" ? $price : $price * $usdKrw;
                $row["currency"] = $currency;
                $row["price"] = $price;
                $row["priceKrw"] = $priceKrw;
                $row["valueKrw"] = $priceKrw * $shares;
                $row["quoteOk"] = true;

                if ($row["name"] === "" || $row["name"] === $row["symbol"]) {
                    if (!empty($quote["name"])) {
                        $row["name"] = $quote["name"];
                    }
                }
            } else {
                $row["quoteError"] = $quote["error"] ?? "시세 없음";
                if ($costKrw > 0) {
                    $row["valueKrw"] = $costKrw;
                    $row["priceKrw"] = $shares > 0 ? $costKrw / $shares : $costKrw;
                }
            }
        }

        $totalKrw += $row["valueKrw"];
        $rows[] = $row;
    }

    foreach ($rows as &$row) {
        $row["weight"] = $totalKrw > 0 ? ($row["valueKrw"] / $totalKrw) * 100 : 0;
    }
    unset($row);

    return [$rows, $totalKrw];
}

function recordHistorySnapshot(&$portfolio, $totalKrw)
{
    $today = gmdate("Y-m-d");
    $history = $portfolio["history"];
    $found = false;

    foreach ($history as &$point) {
        if (($point["date"] ?? "") === $today) {
            $point["totalKrw"] = $totalKrw;
            $found = true;
            break;
        }
    }
    unset($point);

    if (!$found) {
        $history[] = [
            "date" => $today,
            "totalKrw" => $totalKrw,
        ];
    }

    usort($history, function ($a, $b) {
        return strcmp($a["date"] ?? "", $b["date"] ?? "");
    });

    if (count($history) > 400) {
        $history = array_slice($history, -400);
    }

    $portfolio["history"] = $history;
}

function buildSeries($history, $mode)
{
    if (!is_array($history) || count($history) === 0) {
        return [];
    }

    $sorted = $history;
    usort($sorted, function ($a, $b) {
        return strcmp($a["date"] ?? "", $b["date"] ?? "");
    });

    if ($mode === "daily") {
        return array_slice($sorted, -30);
    }

    if ($mode === "weekly") {
        $buckets = [];

        foreach ($sorted as $point) {
            $ts = strtotime($point["date"] . " UTC");
            if ($ts === false) {
                continue;
            }
            $week = gmdate("o-\WW", $ts);
            $buckets[$week] = [
                "date" => $point["date"],
                "label" => $week,
                "totalKrw" => (float) $point["totalKrw"],
            ];
        }

        return array_values(array_slice($buckets, -16, null, true));
    }

    // monthly
    $buckets = [];

    foreach ($sorted as $point) {
        $month = substr($point["date"], 0, 7);
        $buckets[$month] = [
            "date" => $point["date"],
            "label" => $month,
            "totalKrw" => (float) $point["totalKrw"],
        ];
    }

    return array_values(array_slice($buckets, -12, null, true));
}

function portfolioResponse($portfolio)
{
    $usdKrw = fetchUsdKrwRate();
    [$rows, $totalKrw] = enrichHoldings($portfolio["holdings"], $usdKrw);
    recordHistorySnapshot($portfolio, $totalKrw);
    savePortfolio($portfolio);

    $history = $portfolio["history"];
    $prev = count($history) >= 2 ? (float) $history[count($history) - 2]["totalKrw"] : $totalKrw;
    $change = $totalKrw - $prev;
    $changePct = $prev > 0 ? ($change / $prev) * 100 : 0;

    return [
        "ok" => true,
        "authenticated" => true,
        "usdKrw" => $usdKrw,
        "totalKrw" => $totalKrw,
        "changeKrw" => $change,
        "changePct" => $changePct,
        "holdings" => $rows,
        "history" => [
            "daily" => buildSeries($history, "daily"),
            "weekly" => buildSeries($history, "weekly"),
            "monthly" => buildSeries($history, "monthly"),
            "raw" => $history,
        ],
        "updatedAt" => $portfolio["updatedAt"] ?? time(),
    ];
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

if ($method === "GET") {
    $token = getBlogTokenFromRequest();

    if (!isValidBlogToken($token)) {
        http_response_code(401);
        echo json_encode(
            ["error" => "관리자 로그인이 필요합니다.", "authenticated" => false],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    $mode = $_GET["mode"] ?? "";

    if ($mode === "quote") {
        $query = trim((string) ($_GET["q"] ?? $_GET["symbol"] ?? $_GET["name"] ?? ""));

        if ($query === "") {
            http_response_code(400);
            echo json_encode(["ok" => false, "error" => "종목명을 입력해 주세요."], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (isCashSymbol($query) || preg_match('/현금|기타|cash|rest|other/iu', $query)) {
            echo json_encode(
                [
                    "ok" => true,
                    "cash" => true,
                    "symbol" => "CASH",
                    "name" => "현금/기타",
                    "currency" => "KRW",
                    "price" => 1,
                    "priceKrw" => 1,
                ],
                JSON_UNESCAPED_UNICODE
            );
            exit;
        }

        $symbol = resolveStockSymbolFromQuery($query);

        if ($symbol === "") {
            echo json_encode(
                ["ok" => false, "error" => "종목을 찾지 못했습니다.", "query" => $query],
                JSON_UNESCAPED_UNICODE
            );
            exit;
        }

        $quote = fetchStockQuote($symbol);
        $usdKrw = fetchUsdKrwRate();

        if (!$quote || empty($quote["ok"])) {
            echo json_encode(
                [
                    "ok" => false,
                    "symbol" => $symbol,
                    "error" => $quote["error"] ?? "시세를 가져오지 못했습니다.",
                    "usdKrw" => $usdKrw,
                ],
                JSON_UNESCAPED_UNICODE
            );
            exit;
        }

        $price = (float) $quote["price"];
        $currency = strtoupper((string) ($quote["currency"] ?? "USD"));
        $priceKrw = $currency === "KRW" ? $price : $price * $usdKrw;

        echo json_encode(
            [
                "ok" => true,
                "cash" => false,
                "symbol" => $quote["symbol"] ?: $symbol,
                "name" => $quote["name"] ?: $query,
                "currency" => $currency,
                "price" => $price,
                "priceKrw" => $priceKrw,
                "usdKrw" => $usdKrw,
            ],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    $portfolio = loadPortfolio();
    echo json_encode(portfolioResponse($portfolio), JSON_UNESCAPED_UNICODE);
    exit;
}

requireBlogAuth();
$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(["error" => "잘못된 요청입니다."], JSON_UNESCAPED_UNICODE);
    exit;
}

$portfolio = loadPortfolio();

if ($method === "POST") {
    $symbolInput = trim((string) ($input["symbol"] ?? ""));
    $name = trim((string) ($input["name"] ?? ""));
    $shares = (float) ($input["shares"] ?? 0);
    $costKrw = (float) ($input["costKrw"] ?? 0);
    $priceKrw = isset($input["priceKrw"]) ? (float) $input["priceKrw"] : null;
    $asCash = !empty($input["asCash"])
        || isCashSymbol($symbolInput)
        || preg_match('/현금|기타|cash|rest|other/iu', $name);

    if ($name === "" && $symbolInput === "") {
        http_response_code(400);
        echo json_encode(["error" => "종목명을 입력해 주세요."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($asCash) {
        if ($priceKrw === null) {
            $priceKrw = $costKrw > 0 ? $costKrw : $shares;
        }

        if ($priceKrw <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "현금/기타 금액을 입력해 주세요."], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $holding = [
            "id" => bin2hex(random_bytes(8)),
            "name" => $name !== "" ? $name : "현금/기타",
            "symbol" => "CASH",
            "shares" => 1,
            "costKrw" => $priceKrw,
            "priceKrw" => $priceKrw,
            "created" => time(),
        ];
    } else {
        $symbol = "";

        if ($symbolInput !== "") {
            $symbol = resolveStockSymbolFromQuery($symbolInput);
        }

        if ($symbol === "" && $name !== "") {
            $symbol = resolveStockSymbolFromQuery($name);
        }

        if ($symbol === "") {
            http_response_code(400);
            echo json_encode(
                ["error" => "종목명으로 심볼을 찾지 못했습니다. 예: 테슬라, 삼성전자, AAPL"],
                JSON_UNESCAPED_UNICODE
            );
            exit;
        }

        $quote = fetchStockQuote($symbol);
        $resolvedName = $name;

        if ($quote && !empty($quote["ok"])) {
            if ($resolvedName === "" || $resolvedName === $symbol) {
                $resolvedName = (string) ($quote["name"] ?: $symbol);
            }

            if ($shares <= 0 && $costKrw > 0 && $quote["price"] > 0) {
                $usdKrw = fetchUsdKrwRate();
                $priceKrwUnit = strtoupper((string) $quote["currency"]) === "KRW"
                    ? (float) $quote["price"]
                    : (float) $quote["price"] * $usdKrw;
                if ($priceKrwUnit > 0) {
                    $shares = $costKrw / $priceKrwUnit;
                }
            }
        } elseif ($shares <= 0 && $costKrw > 0) {
            // keep cost as fallback value later; still need a share count for non-cash
            http_response_code(400);
            echo json_encode(
                ["error" => "시세를 가져오지 못해 금액만으로는 수량을 환산할 수 없습니다. 수량을 입력해 주세요."],
                JSON_UNESCAPED_UNICODE
            );
            exit;
        }

        if ($shares <= 0) {
            http_response_code(400);
            echo json_encode(["error" => "수량을 입력해 주세요. (금액만 넣으면 시세로 환산 시도)"], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $holding = [
            "id" => bin2hex(random_bytes(8)),
            "name" => $resolvedName !== "" ? $resolvedName : $symbol,
            "symbol" => $symbol,
            "shares" => $shares,
            "costKrw" => $costKrw,
            "created" => time(),
        ];
    }

    $portfolio["holdings"][] = $holding;

    if (!savePortfolio($portfolio)) {
        http_response_code(500);
        echo json_encode(["error" => "포트폴리오 저장에 실패했습니다. writable 권한을 확인해 주세요."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(portfolioResponse($portfolio), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === "DELETE") {
    $id = (string) ($input["id"] ?? "");

    if ($id === "") {
        http_response_code(400);
        echo json_encode(["error" => "삭제할 항목이 없습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $portfolio["holdings"] = array_values(array_filter($portfolio["holdings"], function ($item) use ($id) {
        return (string) ($item["id"] ?? "") !== $id;
    }));
    savePortfolio($portfolio);
    echo json_encode(portfolioResponse($portfolio), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === "PUT") {
    $id = (string) ($input["id"] ?? "");
    $found = false;

    foreach ($portfolio["holdings"] as &$holding) {
        if ((string) ($holding["id"] ?? "") !== $id) {
            continue;
        }

        $found = true;

        if (isset($input["name"])) {
            $holding["name"] = trim((string) $input["name"]);
        }
        if (isset($input["symbol"])) {
            $holding["symbol"] = normalizeStockSymbol($input["symbol"]);
        }
        if (isset($input["shares"])) {
            $holding["shares"] = (float) $input["shares"];
        }
        if (isset($input["costKrw"])) {
            $holding["costKrw"] = (float) $input["costKrw"];
        }
        if (isset($input["priceKrw"])) {
            $holding["priceKrw"] = (float) $input["priceKrw"];
        }
        break;
    }
    unset($holding);

    if (!$found) {
        http_response_code(404);
        echo json_encode(["error" => "종목을 찾을 수 없습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    savePortfolio($portfolio);
    echo json_encode(portfolioResponse($portfolio), JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "허용되지 않은 요청입니다."], JSON_UNESCAPED_UNICODE);
