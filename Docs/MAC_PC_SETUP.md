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

**끝 (올리기 + 사이트 배포):**

```bat
D:\WebWork\MyWebsite\scripts\sync-finish.bat "커밋 메시지"
```

```bash
./scripts/sync-finish.sh "커밋 메시지"
```

또는 Cursor에게 **「올려줘」** → GitHub push **후** Synology Drive 배포 폴더까지 복사합니다.

## Mac 최초 1회

```bash
git clone https://github.com/giicha2/AIwebsite.git ~/Documents/MyWebsite
cd ~/Documents/MyWebsite
# Cursor에서 이 폴더 열기
./scripts/sync-start.sh
```

## NAS에 반영

`scripts/sync-finish`가 작업 폴더를 Synology Drive에 복사합니다 (Windows: `D:\WebWork\SynologyDrive` + `MyWebsite`).  
Drive 동기화가 끝나면 라이브 사이트에 반영됩니다. 코딩은 항상 로컬 작업 폴더에서만.
