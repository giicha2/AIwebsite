<?php
require_once __DIR__ . "/blog-auth-lib.php";

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");

$root = dirname(__DIR__);
$apiDir = __DIR__;
$blogDir = $root . "/blog";
$dataDir = $root . "/data";
$postsFile = $blogDir . "/posts.json";
$testFile = $blogDir . "/.write-test-" . getmypid();
$apiTestFile = $apiDir . "/.write-test-" . getmypid();
$dataTestFile = $dataDir . "/.write-test-" . getmypid();
$homeDir = null;
$user = get_current_user();

if (function_exists("posix_geteuid") && function_exists("posix_getpwuid")) {
    $info = posix_getpwuid(posix_geteuid());
    if (is_array($info) && !empty($info["name"])) {
        $user = $info["name"];
    }
    if (is_array($info) && !empty($info["dir"]) && is_dir($info["dir"])) {
        $homeDir = $info["dir"];
    }
}

if ($homeDir === null && $user !== "") {
    foreach (["/var/services/homes/$user", "/volume1/homes/$user"] as $candidate) {
        if (is_dir($candidate)) {
            $homeDir = $candidate;
            break;
        }
    }
}

$homePostsFile = $homeDir ? $homeDir . "/.1indevtv/posts.json" : null;
$writableDir = resolveWritableDir();
$tmpDir = sys_get_temp_dir();
$tmpTestFile = rtrim($tmpDir, "/") . "/.1indevtv-write-test-" . getmypid();

$phpUser = get_current_user();
if (function_exists("posix_geteuid") && function_exists("posix_getpwuid")) {
    $info = posix_getpwuid(posix_geteuid());
    if (is_array($info) && !empty($info["name"])) {
        $phpUser = $info["name"];
    }
}

$writeTest = false;
$writeError = "";
$apiWriteTest = false;
$apiWriteError = "";
$dataWriteTest = false;
$dataWriteError = "";
$homeWriteTest = false;
$homeWriteError = "";
$writableWriteTest = false;
$writableWriteError = "";
$tmpWriteTest = false;
$tmpWriteError = "";

if (is_dir($apiDir)) {
    $apiWriteTest = @file_put_contents($apiTestFile, "ok", LOCK_EX) !== false;
    if ($apiWriteTest) {
        @unlink($apiTestFile);
    } else {
        $apiWriteError = "api/ 폴더에 새 파일을 만들 수 없습니다.";
    }
}

if (is_dir($dataDir)) {
    $dataWriteTest = @file_put_contents($dataTestFile, "ok", LOCK_EX) !== false;
    if ($dataWriteTest) {
        @unlink($dataTestFile);
    } else {
        $dataWriteError = "data/ 폴더에 새 파일을 만들 수 없습니다.";
    }
}

if (is_dir($blogDir)) {
    $writeTest = @file_put_contents($testFile, "ok", LOCK_EX) !== false;
    if ($writeTest) {
        @unlink($testFile);
    } else {
        $writeError = "blog/ 폴더에 새 파일을 만들 수 없습니다.";
    }
} else {
    $writeError = "blog/ 폴더가 없습니다.";
}

if (is_dir($writableDir)) {
    $writableTestFile = $writableDir . "/.write-test-" . getmypid();
    $writableWriteTest = @file_put_contents($writableTestFile, "ok", LOCK_EX) !== false;
    if ($writableWriteTest) {
        @unlink($writableTestFile);
    } else {
        $writableWriteError = "writable/ 폴더에 새 파일을 만들 수 없습니다.";
    }
} else {
    $writableWriteError = "writable/ 폴더가 없습니다. DSM 파일 스테이션에서 Share_Web 아래에 writable 폴더를 만드세요.";
}

$tmpWriteTest = @file_put_contents($tmpTestFile, "ok", LOCK_EX) !== false;
if ($tmpWriteTest) {
    @unlink($tmpTestFile);
} else {
    $tmpWriteError = "임시 폴더(" . $tmpDir . ")에 파일을 만들 수 없습니다.";
}

if ($homeDir) {
    $homeTestDir = $homeDir . "/.1indevtv";
    if (!is_dir($homeTestDir)) {
        @mkdir($homeTestDir, 0755, true);
    }
    $homeTestFile = $homeTestDir . "/.write-test-" . getmypid();
    $homeWriteTest = @file_put_contents($homeTestFile, "ok", LOCK_EX) !== false;
    if ($homeWriteTest) {
        @unlink($homeTestFile);
    } else {
        $homeWriteError = "홈 폴더에 파일을 만들 수 없습니다.";
    }
}

function permString($path)
{
    if (!file_exists($path)) {
        return null;
    }

    return substr(sprintf("%o", fileperms($path)), -4);
}

function ownerName($path)
{
    if (!file_exists($path)) {
        return null;
    }

    $uid = fileowner($path);

    if (function_exists("posix_getpwuid")) {
        $info = posix_getpwuid($uid);
        if (is_array($info) && !empty($info["name"])) {
            return $info["name"];
        }
    }

    return (string) $uid;
}

echo json_encode(
    [
        "phpUser" => $phpUser,
        "openBasedir" => ini_get("open_basedir") ?: null,
        "paths" => [
            "root" => $root,
            "apiDir" => $apiDir,
            "blogDir" => $blogDir,
            "dataDir" => $dataDir,
            "postsFile" => $postsFile,
            "homeDir" => $homeDir,
            "homePostsFile" => $homePostsFile,
            "writableDir" => $writableDir,
            "tmpDir" => $tmpDir,
        ],
        "permissions" => [
            "root" => permString($root),
            "blogDir" => permString($blogDir),
            "postsFile" => permString($postsFile),
        ],
        "owners" => [
            "root" => ownerName($root),
            "blogDir" => ownerName($blogDir),
            "postsFile" => ownerName($postsFile),
        ],
        "writable" => [
            "root" => is_writable($root),
            "apiDir" => is_writable($apiDir),
            "blogDir" => is_writable($blogDir),
            "dataDir" => is_dir($dataDir) ? is_writable($dataDir) : false,
            "postsFile" => is_writable($postsFile),
            "homeDir" => $homeDir ? is_writable($homeDir) : false,
            "homePostsFile" => $homePostsFile ? is_writable(dirname($homePostsFile)) || is_writable($homePostsFile) : false,
        ],
        "writeTest" => $writeTest,
        "writeError" => $writeError,
        "apiWriteTest" => $apiWriteTest,
        "apiWriteError" => $apiWriteError,
        "dataWriteTest" => $dataWriteTest,
        "dataWriteError" => $dataWriteError,
        "homeWriteTest" => $homeWriteTest,
        "homeWriteError" => $homeWriteError,
        "writableWriteTest" => $writableWriteTest,
        "writableWriteError" => $writableWriteError,
        "tmpWriteTest" => $tmpWriteTest,
        "tmpWriteError" => $tmpWriteError,
        "fix" => "DSM 파일 스테이션에서 Share_Web 아래 writable 폴더를 새로 만든 뒤, giicha2 사용자에게 읽기/쓰기 권한을 부여하세요.",
    ],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
);
