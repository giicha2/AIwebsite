<?php

function findProjectSubdir($root, $name)
{
    $canonical = $root . "/" . $name;

    if (is_dir($canonical)) {
        return $canonical;
    }

    foreach (scandir($root) ?: [] as $entry) {
        if ($entry === "." || $entry === "..") {
            continue;
        }

        if (strcasecmp($entry, $name) === 0 && is_dir($root . "/" . $entry)) {
            return $root . "/" . $entry;
        }
    }

    return $canonical;
}

function writableDirCandidates()
{
    $root = dirname(__DIR__);
    $candidates = [findProjectSubdir($root, "writable")];

    $tmpDir = sys_get_temp_dir();
    if ($tmpDir !== "") {
        $candidates[] = rtrim($tmpDir, "/") . "/1indevtv-writable";
    }

    return array_values(array_unique($candidates));
}

function resolveWritableDir()
{
    foreach (writableDirCandidates() as $dir) {
        if (is_dir($dir) && is_writable($dir)) {
            return $dir;
        }

        if (!is_dir($dir) && @mkdir($dir, 0755, true) && is_writable($dir)) {
            return $dir;
        }
    }

    foreach (writableDirCandidates() as $dir) {
        if (is_dir($dir)) {
            return $dir;
        }
    }

    return findProjectSubdir(dirname(__DIR__), "writable");
}

function authConfigFile()
{
    // Prefer an existing readable password file (Share_Web may be read-only for PHP writes).
    foreach (writableDirCandidates() as $dir) {
        $file = $dir . "/blog-auth.json";

        if (is_file($file) && is_readable($file)) {
            return $file;
        }
    }

    return resolveWritableDir() . "/blog-auth.json";
}

function sessionsFile()
{
    return resolveWritableDir() . "/blog-sessions.json";
}

function readJsonFile($file, $default)
{
    if (!file_exists($file)) {
        return $default;
    }

    $raw = file_get_contents($file);
    $data = json_decode($raw, true);

    return is_array($data) ? $data : $default;
}

function writeJsonFile($file, $data)
{
    $dir = dirname($file);

    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        return false;
    }

    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    if ($json === false) {
        return false;
    }

    return file_put_contents($file, $json, LOCK_EX) !== false;
}

function ensureAuthConfig()
{
    $file = authConfigFile();

    if (!file_exists($file)) {
        return false;
    }

    $config = readJsonFile($file, []);
    return isset($config["passwordHash"]) && $config["passwordHash"] !== "";
}

function isAuthConfigured()
{
    $config = readJsonFile(authConfigFile(), []);
    return isset($config["passwordHash"]) && $config["passwordHash"] !== "";
}

function verifyBlogPassword($password)
{
    if (!ensureAuthConfig()) {
        return false;
    }

    $config = readJsonFile(authConfigFile(), []);
    $hash = $config["passwordHash"] ?? "";

    if ($hash === "") {
        return false;
    }

    return password_verify($password, $hash);
}

function loadSessions()
{
    $sessions = readJsonFile(sessionsFile(), []);
    $now = time();
    $changed = false;

    foreach ($sessions as $token => $expiresAt) {
        if (!is_int($expiresAt) || $expiresAt <= $now) {
            unset($sessions[$token]);
            $changed = true;
        }
    }

    if ($changed) {
        writeJsonFile(sessionsFile(), $sessions);
    }

    return $sessions;
}

function saveSessions($sessions)
{
    return writeJsonFile(sessionsFile(), $sessions);
}

function createBlogToken()
{
    $token = bin2hex(random_bytes(32));
    $sessions = loadSessions();
    $sessions[$token] = time() + 86400;
    saveSessions($sessions);

    return $token;
}

function revokeBlogToken($token)
{
    if ($token === "") {
        return;
    }

    $sessions = loadSessions();

    if (isset($sessions[$token])) {
        unset($sessions[$token]);
        saveSessions($sessions);
    }
}

function isValidBlogToken($token)
{
    if ($token === "") {
        return false;
    }

    $sessions = loadSessions();
    $expiresAt = $sessions[$token] ?? 0;

    return is_int($expiresAt) && $expiresAt > time();
}

function getBlogTokenFromRequest()
{
    return trim($_SERVER["HTTP_X_BLOG_TOKEN"] ?? "");
}

function requireBlogAuth()
{
    if (!isValidBlogToken(getBlogTokenFromRequest())) {
        http_response_code(401);
        echo json_encode(["error" => "관리자 로그인이 필요합니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
