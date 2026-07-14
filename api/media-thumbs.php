<?php

const MEDIA_THUMB_MAX_WIDTH = 480;
const MEDIA_THUMB_QUALITY = 82;

function mediaThumbFolder($root, $folder)
{
    return rtrim($root, "/\\") . "/" . $folder . "/thumbs";
}

function ensureMediaThumbFolder($root, $folder)
{
    $dir = mediaThumbFolder($root, $folder);

    if (is_dir($dir)) {
        return $dir;
    }

    if (@mkdir($dir, 0755, true)) {
        return $dir;
    }

    return null;
}

function loadImageResource($source, $ext)
{
    switch ($ext) {
        case "jpg":
        case "jpeg":
            return @imagecreatefromjpeg($source);
        case "png":
            return @imagecreatefrompng($source);
        case "gif":
            return @imagecreatefromgif($source);
        case "webp":
            return function_exists("imagecreatefromwebp") ? @imagecreatefromwebp($source) : null;
        case "bmp":
            return function_exists("imagecreatefrombmp") ? @imagecreatefrombmp($source) : null;
        default:
            return null;
    }
}

function saveImageThumb($image, $targetFile, $quality = 85)
{
    return @imagejpeg($image, $targetFile, $quality);
}

function resizeImageToThumb($source, $targetFile, $maxWidth = MEDIA_THUMB_MAX_WIDTH)
{
    if (!function_exists("imagecreatetruecolor")) {
        return false;
    }

    $ext = strtolower(pathinfo($source, PATHINFO_EXTENSION));
    $image = loadImageResource($source, $ext);

    if (!$image) {
        return false;
    }

    $srcWidth = imagesx($image);
    $srcHeight = imagesy($image);

    if ($srcWidth <= 0 || $srcHeight <= 0) {
        imagedestroy($image);
        return false;
    }

    if ($srcWidth <= $maxWidth) {
        $targetWidth = $srcWidth;
        $targetHeight = $srcHeight;
    } else {
        $targetWidth = $maxWidth;
        $targetHeight = (int) round($srcHeight * ($maxWidth / $srcWidth));
    }

    $thumb = imagecreatetruecolor($targetWidth, $targetHeight);
    $background = imagecolorallocate($thumb, 255, 255, 255);
    imagefilledrectangle($thumb, 0, 0, $targetWidth, $targetHeight, $background);
    imagecopyresampled(
        $thumb,
        $image,
        0,
        0,
        0,
        0,
        $targetWidth,
        $targetHeight,
        $srcWidth,
        $srcHeight
    );
    imagedestroy($image);

    $saved = saveImageThumb($thumb, $targetFile);
    imagedestroy($thumb);

    return $saved;
}

function ensureImageThumb($root, $srcRelative, $maxWidth = MEDIA_THUMB_MAX_WIDTH)
{
    $srcRelative = str_replace("\\", "/", $srcRelative);

    if (!preg_match("#^(shots|images)/[^/]+$#", $srcRelative)) {
        return null;
    }

    $source = $root . "/" . $srcRelative;

    if (!is_file($source)) {
        return null;
    }

    $folder = explode("/", $srcRelative, 2)[0];
    $filename = explode("/", $srcRelative, 2)[1];
    $stem = pathinfo($filename, PATHINFO_FILENAME);
    $thumbDir = ensureMediaThumbFolder($root, $folder);

    if ($thumbDir === null) {
        return null;
    }

    $thumbFile = $thumbDir . "/" . $stem . ".jpg";
    $thumbRelative = $folder . "/thumbs/" . $stem . ".jpg";

    if (is_file($thumbFile) && filemtime($thumbFile) >= filemtime($source)) {
        return $thumbRelative;
    }

    if (!resizeImageToThumb($source, $thumbFile, $maxWidth)) {
        return is_file($thumbFile) ? $thumbRelative : null;
    }

    return $thumbRelative;
}

function findFfmpegBinary()
{
    if (DIRECTORY_SEPARATOR === "\\") {
        $output = shell_exec("where ffmpeg 2>nul");

        if (is_string($output) && trim($output) !== "") {
            $lines = preg_split("/\R/", trim($output));

            return $lines[0] ?? null;
        }

        return null;
    }

    $candidates = [
        trim((string) shell_exec("command -v ffmpeg 2>/dev/null")),
        "/usr/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/var/packages/VideoStation/target/bin/ffmpeg",
        "/volume1/@appstore/VideoStation/target/bin/ffmpeg",
    ];

    foreach ($candidates as $candidate) {
        if ($candidate !== "" && is_file($candidate) && is_executable($candidate)) {
            return $candidate;
        }
    }

    return null;
}

function ensureVideoPoster($root, $srcRelative)
{
    $srcRelative = str_replace("\\", "/", $srcRelative);

    if (!preg_match("#^videos/[^/]+$#", $srcRelative)) {
        return null;
    }

    $source = $root . "/" . $srcRelative;

    if (!is_file($source)) {
        return null;
    }

    $filename = explode("/", $srcRelative, 2)[1];
    $stem = pathinfo($filename, PATHINFO_FILENAME);
    $thumbDir = ensureMediaThumbFolder($root, "videos");

    if ($thumbDir === null) {
        return null;
    }

    $posterFile = $thumbDir . "/" . $stem . ".jpg";
    $posterRelative = "videos/thumbs/" . $stem . ".jpg";

    if (is_file($posterFile) && filemtime($posterFile) >= filemtime($source)) {
        return $posterRelative;
    }

    $ffmpeg = findFfmpegBinary();

    if ($ffmpeg === null) {
        return is_file($posterFile) ? $posterRelative : null;
    }

    $command = sprintf(
        '%s -y -ss 00:00:01 -i %s -frames:v 1 -q:v 4 %s',
        escapeshellarg($ffmpeg),
        escapeshellarg($source),
        escapeshellarg($posterFile)
    );

    if (DIRECTORY_SEPARATOR === "\\") {
        $command .= " 2>nul";
    } else {
        $command .= " 2>/dev/null";
    }

    @exec($command, $output, $exitCode);

    if ($exitCode !== 0 || !is_file($posterFile)) {
        return is_file($posterFile) ? $posterRelative : null;
    }

    return $posterRelative;
}

function outputCachedThumb($thumbFile, $cacheToken)
{
    if (!is_file($thumbFile)) {
        return false;
    }

    $ext = strtolower(pathinfo($thumbFile, PATHINFO_EXTENSION));
    $mime = "image/jpeg";

    if ($ext === "webp") {
        $mime = "image/webp";
    } elseif ($ext === "png") {
        $mime = "image/png";
    }

    header("Content-Type: " . $mime);
    header("Cache-Control: public, max-age=31536000, immutable");
    header("ETag: \"" . md5($cacheToken) . "\"");
    readfile($thumbFile);

    return true;
}

function outputVideoPosterFallback()
{
    header("Content-Type: image/svg+xml; charset=utf-8");
    header("Cache-Control: public, max-age=86400");
    echo <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="동영상">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" fill="url(#bg)"/>
  <circle cx="160" cy="160" r="42" fill="rgba(255,255,255,0.16)"/>
  <polygon points="148,138 148,182 188,160" fill="#ffffff"/>
</svg>
SVG;
}
