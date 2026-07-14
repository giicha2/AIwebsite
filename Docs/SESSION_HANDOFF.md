# Session handoff (Mac ↔ PC) — MyWebsite

맥·PC Cursor가 이 파일을 공유한다. **작업 끝 → 갱신 → push**, **작업 시작 → pull 후 읽기**.

---

## Last update

| | |
|---|---|
| **From** | PC |
| **When** | 2026-07-14 |
| **Commit context** | Hangul amount + quote fallback |

## Done

- 금액 입력 아래 한글 금액 표기 (일억 이천만 … 원)
- 시세: Yahoo 봇 UA → 브라우저 UA, query1/query2 폴백
- 국내주식(`.KS`/`.KQ`)은 네이버 시세 우선

## Next

- Drive 동기화 후 종목 입력·시세 힌트·한글 금액 확인

## Watch out

- NAS에서 Yahoo가 막히면 해외주식 시세가 실패할 수 있음 (국내는 네이버)
- `writable/portfolio.json` / `blog-auth.json` 은 Git·배포에서 제외

## Notes

- Origin: `https://github.com/giicha2/AIwebsite.git`
