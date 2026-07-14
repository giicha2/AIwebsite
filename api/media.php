<?php
require_once __DIR__ . "/media-thumbs.php";

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

$root = dirname(__DIR__);
$imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic"];
$videoExts = ["mp4", "webm", "mov", "m4v"];

function scanMediaDir($root, $dir, $urlPrefix, $extensions)
{
    $items = [];

    if (!is_dir($dir)) {
        return $items;
    }

    foreach (scandir($dir) as $file) {
        if ($file === "." || $file === "..") {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $file;

        if (!is_file($path)) {
            continue;
        }

        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

        if (!in_array($ext, $extensions, true)) {
            continue;
        }

        $srcRelative = $urlPrefix . "/" . $file;
        $item = [
            "src" => $srcRelative,
            "name" => pathinfo($file, PATHINFO_FILENAME),
            "modified" => filemtime($path),
        ];

        if ($urlPrefix === "shots") {
            $thumb = ensureImageThumb($root, $srcRelative);

            if ($thumb !== null) {
                $item["thumb"] = $thumb;
            }
        }

        if ($urlPrefix === "videos") {
            $poster = ensureVideoPoster($root, $srcRelative);

            if ($poster !== null) {
                $item["poster"] = $poster;
            }
        }

        $items[] = $item;
    }

    usort($items, function ($a, $b) {
        return $b["modified"] - $a["modified"];
    });

    return $items;
}

echo json_encode(
    [
        "photos" => scanMediaDir($root, $root . "/shots", "shots", $imageExts),
        "videos" => scanMediaDir($root, $root . "/videos", "videos", $videoExts),
    ],
    JSON_UNESCAPED_UNICODE
);
