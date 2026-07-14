# Session handoff (Mac ↔ PC) — MyWebsite

맥·PC Cursor가 이 파일을 공유한다. **작업 끝 → 갱신 → push**, **작업 시작 → pull 후 읽기**.

---

## Last update

| | |
|---|---|
| **From** | PC |
| **When** | 2026-07-14 |
| **Commit context** | Private invest page with portfolio charts |

## Done

- **내 자산** 탭 추가 (관리자 로그인 전용)
- 원형 자산 비율 그래프 + 종목 목록 + 종목 추가/삭제
- 전일 종가 기준 평가 (`api/portfolio.php`, `api/stock-lib.php`)
- 투자 총액 클릭 시 일간/주간/월간 증감 그래프 (`invest.js` + Chart.js)

## Next

- Synology 웹 루트에 이 커밋 반영 후 `#invest` / **내 자산**으로 확인
- 맥: `~/Documents/MyWebsite`에서 `./scripts/sync-start.sh` 후 pull
- 실제 보유 종목·수량으로 예시 데이터 교체

## Watch out

- `writable/portfolio.json` / `blog-auth.json` 은 Git에 없음 (NAS만)
- 시세는 NAS에서 외부망(Yahoo) 접근 가능해야 함
- Drive 폴더에서 직접 코딩하지 말 것

## Notes

- Origin: `https://github.com/giicha2/AIwebsite.git`
