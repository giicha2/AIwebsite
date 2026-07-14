# Session handoff (Mac ↔ PC) — MyWebsite

맥·PC Cursor가 이 파일을 공유한다. **작업 끝 → 갱신 → push**, **작업 시작 → pull 후 읽기**.

---

## Last update

| | |
|---|---|
| **From** | PC |
| **When** | 2026-07-14 |
| **Commit context** | Local+Git sync structure like TestAIcode |

## Done

- 웹도 Unreal과 같은 구조로 전환: **로컬 작업 폴더 + GitHub push/pull**
- Windows 작업 폴더: `D:\WebWork\MyWebsite` (Synology Drive 안에서 작업하지 않음)
- `Docs/SESSION_HANDOFF.md`, `scripts/sync-start|finish`, Cursor `git-sync-*` 룰 추가
- 갤러리 썸네일/동영상 포스터·다크모드·시계 12시간 등 PC에서 하던 변경분 작업 폴더에 반영

## Next

- **Mac:** `git clone https://github.com/giicha2/AIwebsite.git ~/Documents/MyWebsite` (최초 1회)
- Mac Cursor에서 `~/Documents/MyWebsite` 연 뒤 `./scripts/sync-start.sh` → 이 메모 읽고 이어서 작업
- NAS 배포용 Drive 폴더(`SynologyDrive/MyWebsite`)는 배포/동기화용으로만 쓰고, 앞으로는 여기서 직접 코딩하지 않기

## Watch out

- 맥·PC에서 동시에 같은 파일 수정하지 말 것
- `writable/blog-auth.json` 은 Git에 안 올라감 — NAS/배포 환경에서만 유지
- `shots/thumbs/`, `videos/thumbs/` 는 로컬 생성물(gitignore). 갤러리에서 필요하면 `scripts/generate-media` 실행 또는 NAS PHP가 생성

## Notes

- Origin: `https://github.com/giicha2/AIwebsite.git`
- Unreal(TestAIcode)과 습관 동일: 시작 pull / 끝 push + 이 메모
