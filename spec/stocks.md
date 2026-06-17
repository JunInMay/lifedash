# stocks — 종목 검색기

## 개요
미국·한국 주식/ETF를 검색하고 시세·차트·재무지표를 확인하는 플러그인. 즐겨찾기 종목을 저장해 빠르게 재조회할 수 있다.

## 기능 명세

### 레이아웃
좌우 2분할:
- **좌(main)**: 선택 종목의 시세·차트·재무지표
- **우(side)**: 검색창 + 검색 결과 or 즐겨찾기 목록

### 검색
- 입력창에 종목명/코드 입력 → 400ms 디바운스 후 검색
- 미국 종목: Yahoo `v1/finance/search` (영문명·코드 정상 동작)
- 한국 종목:
  - 한글 쿼리 → Yahoo가 400 거부 → 내장 테이블 `krSymbols.js` (~55종 KOSPI/KOSDAQ/ETF) 로컬 검색
  - 영문명·6자리 코드("005930") → Yahoo 정상 반환
  - 네이버 증권 API는 회사망 차단으로 불가 (집 네트워크라면 폴백 추가 가능)
- 검색 중 즐겨찾기 목록은 숨겨지고, 검색창 비우면 복귀

### 시세 (좌측 상단)
- 종목명 + 심볼 + ★/☆ 즐겨찾기 버튼
- 현재가 + 등락률 (색상: 상승 빨강, 하락 파랑 — 국내 관례)
- 기준: currency · 3개월 · 시세 기준 시각
- **60초 자동 갱신** (시세만, 재무는 종목 선택 시 1회)
- 같은 종목 재클릭 시 강제 재조회 (`reloadTick`)
- 갱신 실패 시 기존 화면 유지 (일시적 네트워크 오류 대응)

### 차트
- Yahoo Finance v8 chart API, `range=3mo&interval=1d`
- markets 플러그인의 `Chart.jsx` 재사용 (SVG, ResizeObserver)
- ⚠️ `meta.chartPreviousClose`는 3개월 전 종가 → 일간 등락률은 마지막 두 일봉으로 계산

### 재무지표
Yahoo `/ws/fundamentals-timeseries` 엔드포인트 (무인증, KR 포함):

| 항목 | 필드 |
|------|------|
| 시가총액 | trailingMarketCap |
| PER | trailingPeRatio |
| PBR | trailingPbRatio |
| 거래량 | regularMarketVolume |
| 52주 최고/최저 | fiftyTwoWeekHigh/Low |
| 매출 (연간 N개년) | annualTotalRevenue |
| 영업이익 (연간) | annualOperatingIncome |
| 순이익 (연간) | annualNetIncome |

v10 quoteSummary는 2023년부터 crumb+쿠키 인증 필요(401) → 위 timeseries 엔드포인트로 우회.

### 즐겨찾기
- ★/☆ 버튼으로 토글
- 검색창이 비어있을 때 side 목록에 표시
- 즐겨찾기 클릭 시 검색창 비워 목록 유지

## 데이터 소스 및 주의사항

### Yahoo Finance API (무키)
- **KRX 데이터 ~20분 지연 + 개장 직후 공백**: 09:10경 1d 응답 캔들 0개, regularMarketTime=전일 15:30
- 대응: markets 플러그인은 1d 캔들 없으면 2d 재요청, stocks는 시세 기준 시각 표시
- 과도 호출 시 429 → 검색 400ms 디바운스 적용

### 네이버 실시간 시세
- markets 플러그인의 `fetchNaverRealtime` 사용 (한국 지수/종목)
- `polling.finance.naver.com` — 무지연, 무키, 회사망 차단 안 됨 (2026-06-12 실측)
- 실패 시 Yahoo 값으로 자동 폴백

## 저장소

| 키 | 저장소 | 내용 |
|----|--------|------|
| `favorites` | `sharedStorage("stocks")` | `{ symbol, name }[]` — 카드 닫아도 유지 |
| `symbol` | instanceStorage | 마지막 선택 종목 심볼 |
| `symbolName` | instanceStorage | 마지막 선택 종목 표시명 |

> **favorites는 sharedStorage**: 카드를 닫고 재추가해도 즐겨찾기 목록 유지. instanceStorage였다가 2026-06-17 수정.

## 파일 구조
```
src/plugins/stocks/
  index.jsx       ← 메인 컴포넌트
  api.js          ← Yahoo 검색/시세/재무 + 네이버 실시간 시세
  krSymbols.js    ← 한국 주요 종목 내장 테이블 (~55종)
  stocks.css      ← 스타일
  manifest.json
```

markets 플러그인 코드 재사용:
- `Chart.jsx` — SVG 차트
- `fmtPrice`, `fmtPct`, `trendColor`, `fmtMarketTime` — 포맷팅 유틸

## 변경 이력

### 2026-06-11, Claude Fable 5
- 초기 구현: 미국·한국 종목 검색, 시세·3개월 차트·재무지표, 즐겨찾기
- 데이터 소스 조사 (Yahoo 한글 검색 거부, 회사망 증권 사이트 차단, timeseries 우회)

### 2026-06-12
- 시세 정체 버그 수정: 자동 갱신 없었음 → 60초 갱신 + 재클릭 강제 재조회
- 시세 기준 시각 표시 추가
- 네이버 실시간 시세 보정 추가 (한국 종목 ~20분 지연 해소)

### 2026-06-17, Claude Sonnet 4.6
- **즐겨찾기 유지 버그 수정**: 카드 닫고 재추가 시 favorites 초기화 문제 → `instanceStorage` → `sharedStorage("stocks")` 전환

## 향후 과제
- [ ] 한글 검색 개선: 집 네트워크에서 네이버 증권 자동완성 API 폴백 추가 검토
- [ ] 실시간 시세 갱신 주기 설정 (현재 60초 고정)
