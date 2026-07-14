<?php
require_once __DIR__ . "/media-thumbs.php";

$root = dirname(__DIR__);
$path = str_replace("\\", "/", (string) ($_GET["path"] ?? ""));

if (!preg_match("#^(shots|images)/[^/]+$#", $path)) {
    http_response_code(400);
    exit("Invalid path");
}

$source = $root . "/" . $path;

if (!is_file($source)) {
    http_response_code(404);
    exit("Not found");
}

$thumbRelative = ensureImageThumb($root, $path);

if ($thumbRelative !== null) {
    $thumbFile = $root . "/" . $thumbRelative;

    if (outputCachedThumb($thumbFile, $path . filemtime($source))) {
        exit;
    }
}

$ext = strtolower(pathinfo($source, PATHINFO_EXTENSION));
$mime = "application/octet-stream";

if (in_array($ext, ["jpg", "jpeg"], true)) {
    $mime = "image/jpeg";
} elseif ($ext === "png") {
    $mime = "image/png";
} elseif ($ext === "gif") {
    $mime = "image/gif";
} elseif ($ext === "webp") {
    $mime = "image/webp";
}

header("Content-Type: " . $mime);
header("Cache-Control: public, max-age=86400");
readfile($source);
