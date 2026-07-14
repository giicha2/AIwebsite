# Session handoff (Mac ↔ PC) — MyWebsite

맥·PC Cursor가 이 파일을 공유한다. **작업 끝 → 갱신 → push**, **작업 시작 → pull 후 읽기**.

---

## Last update

| | |
|---|---|
| **From** | PC |
| **When** | 2026-07-14 |
| **Commit context** | Compact + add bar for holdings |

## Done

- 종목 추가 UI: `+ | 종목 | 수량 | 금액` 한 줄 입력바로 단순화
- 수량↔금액 전일종가 자동 환산 유지, 수정 시 ✓

## Next

- Drive 동기화 후 `#invest` Ctrl+F5로 추가 바 UI 확인

## Watch out

- `writable/portfolio.json` / `blog-auth.json` 은 Git·배포에서 제외
- 시세·심볼 검색은 NAS 외부망(Yahoo) 필요

## Notes

- Origin: `https://github.com/giicha2/AIwebsite.git`
- Windows 배포: `D:\WebWork\SynologyDrive\` 및 `MyWebsite\`
