# MyWebsite — Mac / PC 작업 안내

웹 홈페이지도 Unreal `TestAIcode`와 같이 **로컬 원본 + Git**으로 맞춘다.

## 경로

| 역할 | Windows | Mac |
|------|---------|-----|
| **작업 폴더** | `D:\WebWork\MyWebsite` | `~/Documents/MyWebsite` |
| **Git origin** | `https://github.com/giicha2/AIwebsite.git` | 동일 |
| Drive 안 폴더 | 배포/참고용. **에디터로 여기만 열어서 코딩하지 않기** | 동일 |

## 매일 습관

**시작 (상대방 변경 받기):**

```bat
D:\WebWork\MyWebsite\scripts\sync-start.bat
```

```bash
cd ~/Documents/MyWebsite && ./scripts/sync-start.sh
```

Cursor는 pull 후 `Docs/SESSION_HANDOFF.md`를 읽고 **From / When / Done / Next / Watch out**을 보고한다.

**끝 (올리기):**

```bat
D:\WebWork\MyWebsite\scripts\sync-finish.bat "커밋 메시지"
```

```bash
./scripts/sync-finish.sh "커밋 메시지"
```

또는 Cursor에게 **「올려줘」**.

## Mac 최초 1회

```bash
git clone https://github.com/giicha2/AIwebsite.git ~/Documents/MyWebsite
cd ~/Documents/MyWebsite
# Cursor에서 이 폴더 열기
./scripts/sync-start.sh
```

## NAS에 반영

GitHub에 올린 뒤, 배포가 Drive/`Share_Web`을 보면:

- 작업 폴더 내용을 배포 경로에 복사하거나
- CI/수동으로 동기화

코딩은 항상 `~/Documents/MyWebsite` 또는 `D:\WebWork\MyWebsite`에서만.
