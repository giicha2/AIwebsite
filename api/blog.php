<?php
require_once __DIR__ . "/blog-auth-lib.php";

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

function phpUserName()
{
    if (function_exists("posix_geteuid") && function_exists("posix_getpwuid")) {
        $info = posix_getpwuid(posix_geteuid());
        if (is_array($info) && !empty($info["name"])) {
            return $info["name"];
        }
    }

    $user = get_current_user();
    return $user !== "" ? $user : null;
}

function phpHomeDir()
{
    if (function_exists("posix_geteuid") && function_exists("posix_getpwuid")) {
        $info = posix_getpwuid(posix_geteuid());
        if (is_array($info) && !empty($info["dir"]) && is_dir($info["dir"])) {
            return $info["dir"];
        }
    }

    $home = $_SERVER["HOME"] ?? "";
    if ($home !== "" && is_dir($home)) {
        return $home;
    }

    $user = phpUserName();
    if ($user === null) {
        return null;
    }

    foreach (["/var/services/homes/$user", "/volume1/homes/$user"] as $candidate) {
        if (is_dir($candidate)) {
            return $candidate;
        }
    }

    return null;
}

function postsFileCandidates()
{
    $root = dirname(__DIR__);
    $candidates = [
        resolveWritableDir() . "/posts.json",
        $root . "/blog/posts.json",
    ];

    $tmpDir = sys_get_temp_dir();
    if ($tmpDir !== "") {
        $candidates[] = rtrim($tmpDir, "/") . "/1indevtv-blog-posts.json";
    }

    $home = phpHomeDir();
    if ($home !== null) {
        $candidates[] = $home . "/.1indevtv/posts.json";
    }

    return $candidates;
}

function canUsePostsFile($postsFile)
{
    $dir = dirname($postsFile);

    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        return false;
    }

    if (file_exists($postsFile)) {
        return @file_put_contents($postsFile, @file_get_contents($postsFile), LOCK_EX) !== false;
    }

    return @file_put_contents($postsFile, "[]\n", LOCK_EX) !== false;
}

function resolvePostsFile()
{
    foreach (postsFileCandidates() as $candidate) {
        if (canUsePostsFile($candidate)) {
            return $candidate;
        }
    }

    return postsFileCandidates()[0];
}

function ensurePostsFile($postsFile)
{
    $dir = dirname($postsFile);

    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            return false;
        }
    }

    if (!file_exists($postsFile)) {
        if (file_put_contents($postsFile, "[]\n", LOCK_EX) === false) {
            return false;
        }
        @chmod($postsFile, 0644);
    }

    return is_writable($postsFile);
}

function readPostsFromFile($postsFile)
{
    if (!file_exists($postsFile)) {
        return [];
    }

    $raw = file_get_contents($postsFile);
    $posts = json_decode($raw, true);

    return is_array($posts) ? $posts : [];
}

function loadPosts($postsFile)
{
    if (!ensurePostsFile($postsFile)) {
        return [];
    }

    $posts = readPostsFromFile($postsFile);

    if ($posts === []) {
        foreach (postsFileCandidates() as $candidate) {
            if ($candidate === $postsFile || !file_exists($candidate)) {
                continue;
            }

            $posts = readPostsFromFile($candidate);
            if ($posts !== []) {
                break;
            }
        }
    }

    usort($posts, function ($a, $b) {
        return ($b["created"] ?? 0) - ($a["created"] ?? 0);
    });

    return $posts;
}

function savePosts($postsFile, $posts)
{
    if (!ensurePostsFile($postsFile)) {
        return false;
    }

    $json = json_encode($posts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    if ($json === false) {
        return false;
    }

    return file_put_contents($postsFile, $json, LOCK_EX) !== false;
}

function readJsonInput()
{
    $input = json_decode(file_get_contents("php://input"), true);
    return is_array($input) ? $input : null;
}

function validatePostFields($title, $content)
{
    if ($title === "" || $content === "") {
        return "제목과 내용을 모두 입력해 주세요.";
    }

    if (mb_strlen($title) > 100) {
        return "제목은 100자 이하로 입력해 주세요.";
    }

    if (mb_strlen($content) > 5000) {
        return "내용은 5000자 이하로 입력해 주세요.";
    }

    return null;
}

function findPostIndex($posts, $id)
{
    foreach ($posts as $index => $post) {
        if (($post["id"] ?? "") === $id) {
            return $index;
        }
    }

    return -1;
}

function saveFailureResponse()
{
    http_response_code(500);
    echo json_encode(
        [
            "error" => "글 저장에 실패했습니다. DSM → 파일 스테이션 → Share_Web에서 writable 폴더를 만들고 "
                . phpUserName()
                . " 사용자에게 읽기/쓰기 권한을 부여해 주세요. (api/perm-check.php 참고)",
        ],
        JSON_UNESCAPED_UNICODE
    );
}

$postsFile = resolvePostsFile();
$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

if ($method === "GET") {
    echo json_encode(loadPosts($postsFile), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === "POST") {
    requireBlogAuth();
    $input = readJsonInput();

    if ($input === null) {
        http_response_code(400);
        echo json_encode(["error" => "잘못된 요청입니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $title = trim($input["title"] ?? "");
    $content = trim($input["content"] ?? "");
    $error = validatePostFields($title, $content);

    if ($error !== null) {
        http_response_code(400);
        echo json_encode(["error" => $error], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $posts = loadPosts($postsFile);
    $post = [
        "id" => (string) round(microtime(true) * 1000),
        "title" => $title,
        "content" => $content,
        "created" => time(),
    ];

    array_unshift($posts, $post);

    if (!savePosts($postsFile, $posts)) {
        saveFailureResponse();
        exit;
    }

    echo json_encode(["ok" => true, "post" => $post], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === "PUT") {
    requireBlogAuth();
    $input = readJsonInput();

    if ($input === null) {
        http_response_code(400);
        echo json_encode(["error" => "잘못된 요청입니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $id = trim($input["id"] ?? "");
    $title = trim($input["title"] ?? "");
    $content = trim($input["content"] ?? "");

    if ($id === "") {
        http_response_code(400);
        echo json_encode(["error" => "수정할 글을 찾을 수 없습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $error = validatePostFields($title, $content);

    if ($error !== null) {
        http_response_code(400);
        echo json_encode(["error" => $error], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $posts = loadPosts($postsFile);
    $index = findPostIndex($posts, $id);

    if ($index < 0) {
        http_response_code(404);
        echo json_encode(["error" => "글이 존재하지 않습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $posts[$index]["title"] = $title;
    $posts[$index]["content"] = $content;
    $posts[$index]["updated"] = time();

    if (!savePosts($postsFile, $posts)) {
        saveFailureResponse();
        exit;
    }

    echo json_encode(["ok" => true, "post" => $posts[$index]], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === "DELETE") {
    requireBlogAuth();
    $input = readJsonInput();

    if ($input === null) {
        http_response_code(400);
        echo json_encode(["error" => "잘못된 요청입니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $id = trim($input["id"] ?? "");

    if ($id === "") {
        http_response_code(400);
        echo json_encode(["error" => "삭제할 글을 찾을 수 없습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $posts = loadPosts($postsFile);
    $index = findPostIndex($posts, $id);

    if ($index < 0) {
        http_response_code(404);
        echo json_encode(["error" => "글이 존재하지 않습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    array_splice($posts, $index, 1);

    if (!savePosts($postsFile, $posts)) {
        saveFailureResponse();
        exit;
    }

    echo json_encode(["ok" => true, "id" => $id], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "허용되지 않은 요청입니다."], JSON_UNESCAPED_UNICODE);
