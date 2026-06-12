<?php
require_once dirname(__DIR__) . "/api/blog-auth-lib.php";

if ($argc < 2) {
    fwrite(STDERR, "사용법: php scripts/set-blog-password.php 새비밀번호\n");
    exit(1);
}

$password = $argv[1];
$writableDir = resolveWritableDir();
$file = $writableDir . "/blog-auth.json";

if (!is_dir($writableDir) && !mkdir($writableDir, 0755, true)) {
    fwrite(STDERR, "writable 폴더를 만들 수 없습니다.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$json = json_encode(["passwordHash" => $hash], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

if (file_put_contents($file, $json . "\n", LOCK_EX) === false) {
    fwrite(STDERR, "blog-auth.json 저장에 실패했습니다.\n");
    exit(1);
}

echo "비밀번호가 저장되었습니다: {$file}\n";
