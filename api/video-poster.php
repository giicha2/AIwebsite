<?php
require_once __DIR__ . "/media-thumbs.php";

$root = dirname(__DIR__);
$path = str_replace("\\", "/", (string) ($_GET["path"] ?? ""));

if (!preg_match("#^videos/[^/]+$#", $path)) {
    http_response_code(400);
    exit("Invalid path");
}

$source = $root . "/" . $path;

if (!is_file($source)) {
    http_response_code(404);
    exit("Not found");
}

$modified = filemtime($source);
$posterRelative = ensureVideoPoster($root, $path);

if ($posterRelative !== null) {
    $posterFile = $root . "/" . $posterRelative;

    if (outputCachedThumb($posterFile, $path . $modified)) {
        exit;
    }
}

outputVideoPosterFallback();
