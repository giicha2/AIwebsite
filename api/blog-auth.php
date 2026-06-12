<?php
require_once __DIR__ . "/blog-auth-lib.php";

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

if ($method === "GET") {
    $token = getBlogTokenFromRequest();

    echo json_encode(
        [
            "configured" => isAuthConfigured(),
            "authenticated" => isValidBlogToken($token),
        ],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

if ($method === "POST") {
    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(["error" => "잘못된 요청입니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $password = (string) ($input["password"] ?? "");

    if ($password === "") {
        http_response_code(400);
        echo json_encode(["error" => "비밀번호를 입력해 주세요."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!verifyBlogPassword($password)) {
        http_response_code(401);
        echo json_encode(["error" => "비밀번호가 올바르지 않습니다."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(
        [
            "ok" => true,
            "token" => createBlogToken(),
        ],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

if ($method === "DELETE") {
    revokeBlogToken(getBlogTokenFromRequest());
    echo json_encode(["ok" => true], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "허용되지 않은 요청입니다."], JSON_UNESCAPED_UNICODE);
