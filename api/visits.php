<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

$visitsFile = dirname(__DIR__) . "/data/visits.json";

function loadVisits($visitsFile)
{
    $default = [
        "total" => 0,
        "today" => "",
        "todayCount" => 0,
    ];

    if (!file_exists($visitsFile)) {
        return $default;
    }

    $raw = file_get_contents($visitsFile);
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        return $default;
    }

    return array_merge($default, $data);
}

function saveVisits($visitsFile, $data)
{
    $dir = dirname($visitsFile);

    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return file_put_contents($visitsFile, $json, LOCK_EX) !== false;
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$data = loadVisits($visitsFile);
$today = date("Y-m-d");

if ($data["today"] !== $today) {
    $data["today"] = $today;
    $data["todayCount"] = 0;
}

if ($method === "POST") {
    $data["total"] = (int) $data["total"] + 1;
    $data["todayCount"] = (int) $data["todayCount"] + 1;

    if (!saveVisits($visitsFile, $data)) {
        http_response_code(500);
        echo json_encode(["error" => "방문자 수 저장에 실패했습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

echo json_encode(
    [
        "total" => (int) $data["total"],
        "todayCount" => (int) $data["todayCount"],
        "today" => $data["today"],
    ],
    JSON_UNESCAPED_UNICODE
);
