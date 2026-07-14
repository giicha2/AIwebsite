# Session handoff (Mac ↔ PC) — MyWebsite

맥·PC Cursor가 이 파일을 공유한다. **작업 끝 → 갱신 → push**, **작업 시작 → pull 후 읽기**.

---

## Last update

| | |
|---|---|
| **From** | PC |
| **When** | 2026-07-14 |
| **Commit context** | No duplicate holdings + edit amount |

## Done

- 같은 심볼(현금 포함) 중복 추가 차단 → 기존 항목 upsert
- 보유 종목 「수정」으로 수량·투자금액 업데이트

## Next

- Drive 동기화 후 `#invest` Ctrl+F5로 중복/수정 확인

## Watch out

- `writable/portfolio.json` / `blog-auth.json` 은 Git·배포에서 제외
- 시세·심볼 검색은 NAS 외부망(Yahoo) 필요

## Notes

- Origin: `https://github.com/giicha2/AIwebsite.git`
- Windows 배포: `D:\WebWork\SynologyDrive\` 및 `MyWebsite\`
