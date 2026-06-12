<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

$root = dirname(__DIR__) . "/projects";
$imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic"];
$videoExts = ["mp4", "webm", "mov", "m4v"];

function findCoverMedia($dir, $slug)
{
    global $imageExts, $videoExts;

    $preferredVideos = ["cover.mp4", "cover.webm", "cover.mov"];
    $preferredImages = ["cover.jpg", "cover.jpeg", "cover.png", "cover.webp", "cover.svg"];

    foreach ($preferredVideos as $name) {
        $path = $dir . DIRECTORY_SEPARATOR . $name;
        if (is_file($path)) {
            return [
                "media" => "projects/" . $slug . "/" . $name,
                "mediaType" => "video",
            ];
        }
    }

    foreach ($preferredImages as $name) {
        $path = $dir . DIRECTORY_SEPARATOR . $name;
        if (is_file($path)) {
            return [
                "media" => "projects/" . $slug . "/" . $name,
                "mediaType" => "image",
            ];
        }
    }

    foreach (scandir($dir) as $file) {
        if ($file === "." || $file === ".." || $file === "info.json") {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $file;

        if (!is_file($path)) {
            continue;
        }

        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

        if (in_array($ext, $videoExts, true)) {
            return [
                "media" => "projects/" . $slug . "/" . $file,
                "mediaType" => "video",
            ];
        }
    }

    foreach (scandir($dir) as $file) {
        if ($file === "." || $file === ".." || $file === "info.json") {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $file;

        if (!is_file($path)) {
            continue;
        }

        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

        if (in_array($ext, $imageExts, true)) {
            return [
                "media" => "projects/" . $slug . "/" . $file,
                "mediaType" => "image",
            ];
        }
    }

    return [
        "media" => "",
        "mediaType" => "",
    ];
}

function buildProject($dir, $slug)
{
    $infoFile = $dir . DIRECTORY_SEPARATOR . "info.json";

    if (!is_file($infoFile)) {
        return null;
    }

    $info = json_decode(file_get_contents($infoFile), true);

    if (!is_array($info)) {
        return null;
    }

    $cover = findCoverMedia($dir, $slug);

    return [
        "id" => $slug,
        "title" => $info["title"] ?? $slug,
        "description" => $info["description"] ?? "",
        "details" => $info["details"] ?? $info["description"] ?? "",
        "status" => $info["status"] ?? "",
        "link" => $info["link"] ?? "",
        "links" => $info["links"] ?? [],
        "sections" => $info["sections"] ?? [],
        "media" => $cover["media"],
        "mediaType" => $cover["mediaType"],
        "modified" => filemtime($infoFile),
    ];
}

function loadProjects($root)
{
    $projects = [];

    if (!is_dir($root)) {
        return $projects;
    }

    foreach (scandir($root) as $slug) {
        if ($slug === "." || $slug === "..") {
            continue;
        }

        $dir = $root . DIRECTORY_SEPARATOR . $slug;

        if (!is_dir($dir)) {
            continue;
        }

        $project = buildProject($dir, $slug);

        if ($project !== null) {
            $projects[] = $project;
        }
    }

    $featuredOrder = ["soul-stone", "vampire-survival"];

    usort($projects, function ($a, $b) use ($featuredOrder) {
        $aRank = array_search($a["id"], $featuredOrder, true);
        $bRank = array_search($b["id"], $featuredOrder, true);
        $aOrder = $aRank === false ? count($featuredOrder) + 1 : $aRank;
        $bOrder = $bRank === false ? count($featuredOrder) + 1 : $bRank;

        if ($aOrder !== $bOrder) {
            return $aOrder - $bOrder;
        }

        return ($b["modified"] ?? 0) - ($a["modified"] ?? 0);
    });

    return $projects;
}

if (isset($_GET["id"])) {
    $slug = basename($_GET["id"]);
    $dir = $root . DIRECTORY_SEPARATOR . $slug;
    $project = is_dir($dir) ? buildProject($dir, $slug) : null;

    if ($project === null) {
        http_response_code(404);
        echo json_encode(["error" => "프로젝트를 찾을 수 없습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode($project, JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(loadProjects($root), JSON_UNESCAPED_UNICODE);
