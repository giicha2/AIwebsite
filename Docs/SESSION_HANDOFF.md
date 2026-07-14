# Session handoff (Mac ↔ PC) — MyWebsite

맥·PC Cursor가 이 파일을 공유한다. **작업 끝 → 갱신 → push**, **작업 시작 → pull 후 읽기**.

---

## Last update

| | |
|---|---|
| **From** | PC |
| **When** | 2026-07-14 |
| **Commit context** | Invest layout merge + auto symbol |

## Done

- 투자 총액·증감 그래프를 **자산 비율** 카드 상단으로 합침
- 종목 추가: 심볼 수동 입력 제거 → 종목명으로 심볼 자동 해석(별칭 + Yahoo 검색)
- 추가 폼 `name` 필드 충돌(`holdingName`) 및 저장 실패 메시지 보강

## Next

- Drive 동기화 후 `#invest` Ctrl+F5로 추가·레이아웃 확인

## Watch out

- `writable/portfolio.json` / `blog-auth.json` 은 Git·배포에서 제외
- 시세·심볼 검색은 NAS 외부망(Yahoo) 필요

## Notes

- Origin: `https://github.com/giicha2/AIwebsite.git`
- Windows 배포: `D:\WebWork\SynologyDrive\` 및 `MyWebsite\`
