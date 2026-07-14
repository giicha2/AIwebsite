# Session handoff (Mac ↔ PC) — MyWebsite

맥·PC Cursor가 이 파일을 공유한다. **작업 끝 → 갱신 → push**, **작업 시작 → pull 후 읽기**.

---

## Last update

| | |
|---|---|
| **From** | PC |
| **When** | 2026-07-14 |
| **Commit context** | Auto-deploy Synology Drive on 올려줘 |

## Done

- **올려줘** = GitHub push + Synology Drive 배포 자동 (`scripts/deploy-to-synology` + `git-sync-finish` 룰)
- **내 자산** 탭 (로그인, 원형 비율, 종목 추가, 총액 일·주·월 그래프)

## Next

- Drive 동기화 후 사이트에서 **내 자산** 확인 (Ctrl+F5)
- 맥도 sync-finish 시 Drive 경로로 배포됨

## Watch out

- `writable/portfolio.json` / `blog-auth.json` 은 Git·배포에서 제외
- 시세는 NAS 외부망(Yahoo) 필요

## Notes

- Origin: `https://github.com/giicha2/AIwebsite.git`
- Windows 배포: `D:\WebWork\SynologyDrive\` 및 `MyWebsite\`
