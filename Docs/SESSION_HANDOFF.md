# Session handoff (Mac ↔ PC) — MyWebsite

맥·PC Cursor가 이 파일을 공유한다. **작업 끝 → 갱신 → push**, **작업 시작 → pull 후 읽기**.

---

## Last update

| | |
|---|---|
| **From** | PC |
| **When** | 2026-07-14 |
| **Commit context** | Total+chart unify, shares↔cost sync |

## Done

- 투자 총액 + 증감 그래프를 한 패널로 통합 (토글 제거, 항상 표시)
- 종목 추가 시 수량↔금액 시세 자동 환산 (quote API `mode=quote&q=`)

## Next

- Drive 동기화 후 `#invest` Ctrl+F5로 총액 패널·수량/금액 환산 확인

## Watch out

- `writable/portfolio.json` / `blog-auth.json` 은 Git·배포에서 제외
- 시세·심볼 검색은 NAS 외부망(Yahoo) 필요

## Notes

- Origin: `https://github.com/giicha2/AIwebsite.git`
- Windows 배포: `D:\WebWork\SynologyDrive\` 및 `MyWebsite\`
