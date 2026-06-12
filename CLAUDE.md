# lifedash-fable

## 프로젝트 개요
개인화 가능한 대시보드 플랫폼. 빈 캔버스(칠판) 위에 플러그인을 자유롭게 배치해서 나만의 화면을 만드는 앱. 컴퓨터를 켰을 때 가장 먼저 켜는, 내게 필요한 도구와 정보만 모아 보는 대시보드.

- **컨셉**: "앱 위의 앱" — 플러그인 생태계 기반 개인 대시보드
- **비유**: 데스크탑 위의 가상 스마트폰. 앱스토어에서 앱 받아서 홈화면에 배치하는 UX
- **타겟**: 개인 사용자 (처음엔 혼자 쓸 용도, 이후 플러그인 마켓으로 오픈 생태계 확장)
- **계보**: `D:\VibeProjects\lifedash` 프로토타입의 기획을 이어받은 2세대 구현
- **최종 목표**: lifedash 플러그인 마켓 — 자작 플러그인을 등록/배포하는 오픈 생태계

## 메타 정보 (다음 에이전트를 위한 안내)

| 항목 | 내용 |
|------|------|
| 작성 시점 | 2026-06-10 |
| 초기 구현 | Claude Fable 5 (Claude Code 세션, 작업 디렉토리는 `C:\LF_DEV\lfmall-admin-renew`였음 — 업무 repo 세션에서 사이드 프로젝트로 작업) |
| 사용자 | 한국어 사용. 간결한 보고 선호. 위임 후 결과만 확인하는 스타일 |
| git | 로컬 repo만 존재 (원격 없음). master 브랜치 단일 |
| 빌드 상태 | `npm run build` ✅ / Electron 스모크(`LIFEDASH_SMOKE=1`) ✅ / 데스크탑 앱은 `npm run electron:dev` |
| 셸 런타임 | **Electron 31** (2026-06-12 Tauri에서 마이그레이션 — 사유는 MIGRATION.MD와 작업 이력 참조). `src-tauri/`는 레거시로 보존만 |

### ⚠️ 환경 특이사항 (모르면 헤맨다)
1. **사내망 SSL 인터셉션**: 이 PC는 회사망이라 HTTPS가 자체 서명 인증서로 가로채진다.
   - Node(vite 프록시)에서 외부 HTTPS 호출 시 `self-signed certificate in certificate chain` 에러 → vite 프록시에 `secure: false` 필수 (이미 적용됨)
   - **electron 바이너리 설치 시** `$env:NODE_EXTRA_CA_CERTS='C:\LF_WIDE\bin\ssl_cert\dev_napi.lfmall.co.kr_2.cer'` 설정 후 `npm install` (MIGRATION.MD 실측)
   - Electron 메인 프로세스에서는 **Node fetch 대신 `net.fetch`(Chromium 스택)** 사용 — OS 인증서 저장소를 신뢰해 사내망에서도 동작 (electron/main.cjs가 이미 그렇게 함)
   - (레거시 tauri) cargo는 `$env:CARGO_HTTP_CHECK_REVOKE = "false"` 필요
2. **포트 규칙 (중요, 사용자가 직접 지시함)**:
   - **1430** = 사용자의 `npm run electron:dev`(내장 vite) 전용. **AI 에이전트가 검증용으로 점거하면 절대 안 됨** (실제로 충돌 사고 2회)
   - **1435** = AI 검증용 프리뷰 포트. `npm run dev -- --port 1435`로 실행 (`.claude/launch.json`에 설정돼 있음)
   - 검증이 끝나면 반드시 dev 서버를 종료하고, 고아 node 프로세스가 포트를 물고 있지 않은지 `Get-NetTCPConnection -LocalPort <port> -State Listen`으로 확인
3. **localStorage는 origin별**: 1430(사용자 실사용), 1435(검증용), 빌드 앱(file://)은 각각 별도 저장소다. 1435에서 테스트로 만든 레이아웃은 사용자 화면에 안 나타난다.
4. Windows + PowerShell 환경. git이 CRLF 경고를 내지만 무해.
5. `src-tauri/target`(~2.7GB)은 레거시 cargo 캐시 — Tauri로 돌아갈 일 없다고 확정되면 지워도 됨.

## 기술 스택
- **Electron 31** — 데스크탑 셸 (2026-06-12 Tauri v2에서 마이그레이션). 진입점 `electron/main.cjs` + `electron/preload.cjs`
  - 마이그레이션 사유: Tauri child webview는 OS 네이티브 표면이라 드로어/카드가 절대 못 덮음. Electron `<webview>` 태그는 **DOM에 합성**되어 z-index/클리핑이 일반 콘텐츠처럼 동작 (PoC: `electron-poc/`, MIGRATION.MD)
- **React 19** — 프론트엔드 (Tauri 시절 코드 그대로 재사용, Tauri API 호출부만 브리지로 치환)
- **Vite 7** — 빌드 도구 (`base: "./"` — file:// 로드 대응)
- **react-draggable / react-resizable** — 카드 드래그/리사이징
- **window.lifedash 브리지** (preload) — CORS 없는 fetch(`net.fetch`), openExternal, 파일 다이얼로그, fs exists, media:// 프로토콜, 전체화면. 렌더러에서는 `src/core/desktop.js` 헬퍼로 접근

## 구조

```
electron/
  main.cjs              ← Electron 메인: 창 생성, IPC(net:fetch/dialog/fs/fullscreen/openExternal),
                          media:// 프로토콜, 스모크 테스트(LIFEDASH_SMOKE=1)
  preload.cjs           ← window.lifedash 브리지 노출 (contextIsolation+sandbox 유지)
src/
  core/
    PluginRegistry.js   ← import.meta.glob 기반 플러그인 자동 발견
    Dashboard.jsx       ← 칠판: 인스턴스 추가/제거/배치 관리
    PluginCard.jsx      ← 드래그/리사이즈/닫기 카드 셸
    PluginDrawer.jsx    ← "+ 플러그인" 추가 패널
    eventBus.js         ← 플러그인 간 pub/sub 이벤트 버스
    storage.js          ← 레이아웃 + 플러그인별 네임스페이스 저장소
    desktop.js          ← 데스크탑 브리지 헬퍼 (isDesktop/desktopFetch/openExternal/toggleFullscreen)
    WebviewEmbed.jsx    ← <webview> 임베드 컴포넌트 (youtube/teams/browser가 사용)
  plugins/
    <plugin-dir>/
      index.jsx         ← 플러그인 컴포넌트 (default export)
      manifest.json     ← 메타데이터
      *.js / *.css      ← 부속 파일 자유 (registry는 index.jsx/manifest.json만 본다)
electron-poc/           ← 마이그레이션 검증용 PoC (참고용 보존)
src-tauri/              ← 레거시 Tauri 셸 (더 이상 빌드 대상 아님, 참고용 보존)
```

## 플러그인 시스템

### 설계 원칙
- **칠판(Dashboard)**이 플러그인의 위치/크기/생명주기를 관리. **플러그인**은 자기 내부 데이터만 관리
- 같은 플러그인을 여러 개 배치 가능 (인스턴스 단위, `instanceId`로 구분)
- 플러그인 폴더만 만들면 자동 등록 — 레지스트리에 코드 추가 불필요

### 플러그인 작성법
`src/plugins/<dir>/` 아래 두 파일이 필수:

**manifest.json** — `defaultSize`/`minSize`는 픽셀 단위, `id`는 폴더명과 일치 권장
```json
{
  "id": "todo", "name": "할 일", "icon": "✅",
  "description": "체크리스트", "version": "1.0.0",
  "defaultSize": { "w": 300, "h": 320 }, "minSize": { "w": 240, "h": 200 }
}
```

**index.jsx** — default export 컴포넌트. 받는 props:

| prop | 설명 |
|------|------|
| `instanceId` | 이 인스턴스의 고유 ID |
| `storage` | 인스턴스 전용 저장소 `{ get(key, fallback), set(key, value), remove(key) }` |
| `bus` | 이벤트 버스 `{ on(event, handler) → unsubscribe, emit(event, payload) }` — 이벤트명 컨벤션 `"<pluginId>:<event>"` |
| `width` / `height` | 현재 카드 크기 (px, 리사이즈 종료 시점에만 갱신) |

### 저장소 키 구조 (localStorage)
- `lifedash.layout` — 인스턴스 배열 `[{ instanceId, pluginId, x, y, w, h }]`
- `lifedash.plugin.<instanceId>` — 플러그인 인스턴스별 데이터. 인스턴스 제거 시 함께 삭제됨
- `lifedash.shared.<pluginId>` — 같은 플러그인의 모든 인스턴스가 공유, 인스턴스 생명주기와 무관하게 유지(`storage.js`의 `createSharedStorage(pluginId)`). 카드를 닫았다 다시 추가해도 남아있어야 하는 "라이브러리"성 데이터에 사용 (예: videoplayer의 동영상 목록)

### 외부 API 호출 공통 패턴 (CORS 이중화)
모든 네트워크 플러그인이 같은 패턴을 쓴다 (`isDesktop() ? desktopFetch(절대URL) : fetch(프록시경로)`):
- **Electron 앱**: `desktopFetch` → IPC → 메인 프로세스 `net.fetch` (CORS 없음, 도메인 등록 불필요, OS 인증서 신뢰)
- **브라우저 dev**: vite 프록시 경유 (`vite.config.js`의 `server.proxy`, 전부 `secure: false`)

| 프록시 (브라우저 dev용) | 대상 | 사용 플러그인 |
|--------|------|---------------|
| `/yahoo` | query1.finance.yahoo.com | markets, stocks |
| `/npoll` | polling.finance.naver.com | markets, stocks (한국 실시간) |
| `/gtx` | translate.googleapis.com | translator, dictionary(영한) |
| `/dict` | api.dictionaryapi.dev | dictionary(영영) |
| `/gnews` | news.google.com | news |
| `/openai` | api.openai.com | aichat(GPT) |
| (직접) | api.anthropic.com | translator(AI), aichat(Claude) — `anthropic-dangerous-direct-browser-access` 헤더로 브라우저 CORS 허용 |

새 외부 API 추가 시: vite 프록시 1개(브라우저 dev용) + `isDesktop()` 분기 fetch 래퍼. Electron 쪽은 추가 설정 없음 (Tauri capability 등록은 이제 불필요).

## 구현된 플러그인

| id | 이름 | 핵심 | 데이터 소스 |
|----|------|------|------------|
| `clock` | 시계 | 시각+날짜 | - |
| `timer` | 타이머 | 밀리초 스톱워치, Date.now 기반 | - |
| `todo` | 할 일 | storage 영속 | - |
| `notes` | 메모 | 입력 즉시 저장 | - |
| `links` | 바로가기 | 기본 브라우저로 열기(opener), 브라우저 dev는 window.open fallback | - |
| `markets` | 시장 지표 | 32개 지표, 좌측 SVG 차트(1일/1주/1개월/1년) + 우측 목록 클릭 전환 | Yahoo Finance v8 chart API (무키) |
| `youtube` | 유튜브 | `<webview>`로 진짜 youtube.com을 카드 안에 표시 | - (데스크탑 전용) |
| `translator` | 번역기 | 하이브리드: 무료 구글 기본, Claude API 키 입력 시 AI 번역 | 구글 gtx / Anthropic Messages API |
| `dictionary` | 사전 | 영영/영한, 좌측 뜻풀이 + 우측 검색 기록 재조회 | dictionaryapi.dev / 구글 gtx `dt=bd` |
| `teams` | 팀즈 | `<webview>`로 진짜 teams.microsoft.com을 카드 안에 표시 (로그인 세션 영속) | - (데스크탑 전용) |
| `aichat` | AI 채팅 | Claude/GPT 선택, 영어 회화용 시스템 프롬프트 기본값, 대화 storage 영속 | Anthropic / OpenAI API (키 필요) |
| `news` | 뉴스 | 국가별(한/미/일/영/독 다중 선택) 실시간 헤드라인, 국가 간 라운드로빈 공평 배분, 5분 갱신 | Google News RSS (무키) |
| `stocks` | 종목 검색 | 미국·한국 주식/ETF 검색, 일간 등락·3개월 차트·재무지표·즐겨찾기 | Yahoo Finance (무키, 아래 메모 필독) |
| `videoplayer` | 동영상 재생기 | 여러 경로의 로컬 동영상을 모아 재생, 우측 목록·호버 컨트롤·카드 내 최대화 | - (로컬 파일, 데스크탑 전용) |
| `browser` | 웹뷰 | 사용자가 입력한 임의 URL을 `<webview>`로 카드 안에 표시, 주소창에서 변경 가능 | - (데스크탑 전용) |

### 플러그인별 구현 메모

**markets** — 지표 추가/제거는 `symbols.js`만 수정. 선택 지표 60초 갱신, 목록 등락률은 400ms 간격 순차 순회 후 3분 휴식(API 부하 분산). 등락 색상은 국내 관례(상승 빨강/하락 파랑). 차트는 의존성 없는 순수 SVG(`Chart.jsx`, ResizeObserver로 크기 추적).

**youtube** — 유튜브는 iframe 차단(X-Frame-Options)이라 **Electron `<webview>` 태그**로 해결. `WebviewEmbed` 한 줄이 전부. `partition="persist:youtube"`로 로그인 세션 유지. 브라우저 dev에서는 안내 문구만 표시.

**translator** — 엔진 추상화는 `engines.js`의 `translate({engine, ...})` 한 곳. DeepL 등 추가 시 여기만 수정. Claude 모델 선택지: `claude-haiku-4-5`(기본), `claude-sonnet-4-6`, `claude-opus-4-8`. API 키는 인스턴스 storage(localStorage)에만 저장.

**dictionary** — 영한은 구글 gtx에 `dt=bd` 추가 시 `json[1]`에 품사별 대역어가 옴(`tl=ko`라 품사명도 한국어로 옴). 검색 기록은 `{word, mode}` 최대 30개, 성공한 검색만 기록.

**teams** — youtube와 동일 패턴, URL만 `teams.microsoft.com`. `partition="persist:teams"`라 로그인 세션이 재시작 후에도 유지됨.

**aichat** — provider 추상화는 `api.js`의 `sendChat({provider, ...})`. Claude는 `anthropic-dangerous-direct-browser-access` 헤더로 어디서든 직접 호출, OpenAI는 브라우저 CORS 불가라 dev는 `/openai` 프록시·Tauri는 plugin-http. 키/모델은 provider별로 storage에 분리 저장(`keys`, `models` 맵). 모델은 자유 입력(기본 claude-haiku-4-5 / gpt-5-mini — 모델 단종에 대비해 select 대신 텍스트). 시스템 프롬프트 기본값은 영어 회화 파트너(짧은 답 + 문법 교정 괄호), 설정에서 수정 가능. 전송 시 최근 20개 메시지만 보냄(SEND_WINDOW), storage 보관은 최대 100개.

**news** — Google News RSS (`news.google.com/rss?hl=..&gl=..&ceid=..`), 국가별 파라미터는 `api.js`의 COUNTRIES. 선택 국가들을 국가당 동일 개수로 가져와 라운드로빈 교차 배치(기사량 많은 국가의 독점 방지 — 사용자 요구). 제목의 " - 매체명" 접미사는 `<source>`와 중복이라 제거. 원래 요구사항에 있던 "1/7/30일 영향력 기사 랭킹"은 무료·무키 소스 부재로 **스펙 아웃** (사용자 확정).

**stocks — 재무 데이터 소스 메모 (필독, 사용자 지시로 기록)**
- 검색: Yahoo `v1/finance/search` — 단, **한글 쿼리는 400 (Invalid Search Query)으로 거부됨** (프록시/직접 호출 모두 실측 확인. lookup 엔드포인트는 200이나 한글 매칭 결과 없음). 영문명("samsung")·종목코드("005930")는 한국 종목까지 정상 반환.
- 한글 검색 해법: **내장 한국 주요 종목 테이블** `krSymbols.js` (~55종, KOSPI/KOSDAQ/ETF). 네이버 증권 API(`ac.stock.naver.com`)가 정석 대안이지만 **사용자 회사망이 증권 사이트를 차단**해서 불가 (Yahoo Finance API는 차단 안 됨). 집 네트워크 전용이라면 네이버 폴백 추가 가능.
- 재무지표: v10 quoteSummary는 2023년부터 **crumb+쿠키 인증 필요(401)** → 대신 무인증으로 동작하는 **`/ws/fundamentals-timeseries/v1/finance/timeseries/{symbol}`** 사용 (Yahoo 재무 차트 페이지가 쓰는 엔드포인트). type 파라미터로 trailingPeRatio/trailingPbRatio/trailingMarketCap/annualTotalRevenue/annualOperatingIncome/annualNetIncome 요청, KR 종목 포함 동작 확인. 막히면 crumb 흐름(fc.yahoo.com 쿠키 → /v1/test/getcrumb)으로 전환 검토.
- 시세/차트: v8 chart `range=3mo&interval=1d`. ⚠️ 이 범위에서 `meta.chartPreviousClose`는 전일이 아니라 **3개월 전 종가** — 일간 등락률은 마지막 두 일봉으로 계산해야 함 (실제로 +57.89%로 잘못 나왔던 버그 수정함).
- markets 플러그인의 `Chart.jsx`/`fmtPrice`/`trendColor`를 import해 재사용 (플러그인 간 의존 첫 사례).
- Yahoo는 과도 호출 시 429를 줌 — 검색은 400ms 디바운스 적용.
- **Yahoo KRX 데이터는 ~20분 지연 + 개장 직후 공백** (실측: 09:10에 ^KS11 1d 응답 캔들 0개, 삼성전자 regularMarketTime=전일 15:30). 대응: ① markets의 1d 차트는 캔들이 없으면 2d로 재요청해 마지막 거래일 세션을 잘라 표시, ② 두 플러그인 모두 시세 기준 시각을 화면에 표시, ③ stocks는 60초 자동 갱신 + 같은 종목 재클릭 시 강제 재조회(reloadTick).
- **한국 시세는 네이버 폴링 API로 실시간 보정** (`markets/api.js`의 `fetchNaverRealtime`): `polling.finance.naver.com/api/realtime/domestic/{index|stock}/{code}` — **무지연(delayTime: 0), 키 불필요**. 한국 지수(^KS11→KOSPI, ^KQ11→KOSDAQ, ^KS200→KPI200)와 6자리 코드 종목(.KS/.KQ)의 가격/등락률/거래량을 덮어쓰고, 차트 곡선은 Yahoo(지연) 유지. 실패 시 조용히 Yahoo 값 폴백. 응답 숫자는 콤마 문자열이라 파싱 필요.
  - ⚠️ 주의: 회사망이 `ac.stock.naver.com` 등 네이버 증권 호스트 대부분을 차단하지만 **polling.finance.naver.com만은 차단 안 됨** (2026-06-12 실측). 언젠가 막히면 자동으로 Yahoo 지연 시세로 폴백되므로 앱은 깨지지 않음.

**웹뷰 공통 (youtube/teams/browser)** — `src/core/WebviewEmbed.jsx` (Electron `<webview>` 태그) 사용. 새 웹뷰 플러그인은 `<WebviewEmbed url=... partition="persist:..."/>` 한 줄이면 된다.
- `<webview>`는 **DOM 요소로 합성**되므로: z-index/드로어 겹침 정상, 카드 border-radius·overflow 클리핑 정상, **4모서리 리사이즈 핸들 전부 동작**. Tauri 시절의 rAF 추적·corner inset·동적 수축·핸들 제약이 전부 사라짐 (해당 시행착오 기록은 작업 이력 참조 — 다시 구현할 필요 없음).
- `partition="persist:<name>"`으로 플러그인별 세션 분리 + 로그인 영속.
- 메인 창 webPreferences에 `webviewTag: true` 필수 (electron/main.cjs에 설정됨). `allowpopups`로 OAuth 팝업 허용.

**browser** — 도메인 고정 없이 사용자가 입력한 임의 URL을 표시하는 범용 webview 플러그인. HTML 주소창(`.browser-bar`) + `<WebviewEmbed url={url}>`. URL은 인스턴스 storage(`url`)에 저장, `https://` 자동 보정.

**videoplayer** — `<video>` 엘리먼트 기반. 좌측 video + 우측 동영상 목록(추가/제거), 호버 시 이전/재생-정지/다음 오버레이 + 카드 내 최대화(목록 숨김) 버튼. 동영상은 **파일 다이얼로그로 개별 경로를 모아** 공유 storage에 저장(`{path, name}[]`). 마운트/목록 변경 시 `window.lifedash.fileExists()`로 경로 생존 확인, `window.lifedash.mediaSrc(path)`(`media://v/?p=<encoded>` 커스텀 프로토콜, main.cjs의 `protocol.handle`)로 `<video src>` 연결. 브라우저 dev에서는 "데스크탑 전용" 안내만 표시.

## 작업 이력

### 2026-06-10, Claude Fable 5
| 커밋 | 내용 |
|------|------|
| `eb61734` | 초기 구현: 코어(레지스트리/칠판/카드/드로어/버스/스토리지) + 기본 플러그인 5종 |
| `a22d932` | markets 플러그인 + tauri-plugin-http 도입 + 사내망 SSL 대응(`secure:false`) |
| `99b9004` | AI 검증용 프리뷰 포트를 1435로 분리 (1430 충돌 사고 후속) |
| `ac40422` | youtube 플러그인 (child webview, unstable feature) |
| `7fdddc0` | translator 플러그인 (하이브리드 엔진) |
| `f81d8fc` | dictionary 플러그인 (영영/영한) |

검증된 것: 프론트 빌드, cargo check(권한/capability 빌드타임 검증 포함), 브라우저 프리뷰에서 각 플러그인 실데이터 동작(시장 지표 실시세, 번역 한↔영, 사전 양 모드, 기록 재조회).

### 2026-06-10 (이어서, Sonnet)
- **teams 플러그인 추가**: youtube와 동일한 child webview 패턴, `teams.microsoft.com` 임베드. 사용자가 데스크탑 앱에서 로그인까지 정상 동작 확인.
- **PluginCard 리사이즈 핸들 NW/NE 추가**: SE만 있던 기본 핸들에 좌상/우상 추가. NW/NE 리사이즈 시 기준점 이동 보정(`onResizeStart`에서 시작값 기록, `n`/`w` 포함 핸들이면 x/y 보정). SW는 웹뷰 가려짐 문제로 보류했었음.

### 2026-06-11, Claude Fable 5
| 커밋 | 내용 |
|------|------|
| (this) | 웹뷰 inset frame + 4모서리 핸들 완성, 정렬 버튼, aichat 플러그인 |

- **웹뷰 리사이즈 핸들 시행착오 (중요한 교훈)**: youtube/teams의 추적 로직을 `useChildWebview` 훅으로 추출하고 4모서리 핸들 활성화(`["se","sw","ne","nw"]`). 핸들 노출 방식은 3번 바뀜:
  1. 고정 마진(inset frame 6~14px) → 사용자가 베젤을 싫어함
  2. `cursorPosition()` 폴링 기반 동적 수축 → **실기기에서 평소에도 꽉 차지 않는 문제 발생** (커서 API가 런타임 실패해 폴백 inset 14px이 상시 적용된 것으로 추정. `getCurrentWindow().cursorPosition()` 또는 권한이 이 Tauri 버전에서 기대대로 동작하지 않았을 가능성 — 재시도할 거면 tauri dev에서 콘솔로 실패 원인부터 확인할 것)
  3. **최종: 상시 꽉 채움 + 3px corner inset** (사용자 결정). 웹뷰 플러그인의 하단 핸들은 포기하고 상단(ne/nw) 핸들로 리사이즈.
- **⊞ 정렬 버튼** (topbar): 깨진 레이아웃 복구용. 현재 배치의 읽기 순서(위→아래, 왼→오른쪽)대로 크기를 유지한 채 재배치. 화면 밖으로 나간 카드도 복구됨. 이를 위해 PluginCard에 외부 좌표 변경 동기화 effect 추가(`instance.x/y` 변경 시 로컬 드래그 상태 갱신 — 이게 없으면 정렬해도 카드가 안 움직임).
- **정렬 알고리즘 개선 (사용자 피드백 반영)**: 처음엔 행 단위 선반(shelf) 방식이었는데, 한 줄의 높이가 가장 키 큰 카드로 잡혀서 키 작은 카드 아래 공간이 통째로 버려지는 문제 지적받음. **bottom-left 그리디 패킹**으로 교체 — 각 카드를 "가장 위쪽, 그중 가장 왼쪽"의 들어갈 수 있는 빈자리에 배치(후보 = 좌상단 + 놓인 카드들의 바로 아래/바로 오른쪽, y→x 정렬 후 첫 비충돌 위치). 간격도 16px → **4px**(거의 밀착)로 축소. 검증: 높이 100/200 첫 줄 후 300짜리가 100짜리 바로 아래(y=108)에 끼어 들어가는 것 확인.
- **aichat 플러그인**: Claude/GPT 듀얼 provider 영어 채팅 (위 구현 메모 참조). 검증: 무효 키로 OpenAI 실서버 401 왕복, provider 전환·설정 저장, 버블 UI. Claude 경로는 translator와 동일 코드 패턴이라 실키 검증은 사용자 몫.

### 2026-06-11 (이어서)
- **뉴스/종목 검색 플러그인 추가** (요구사항: 사용자 제공 표 기반, 일부 스펙은 협의로 조정)
  - 뉴스: 기간(1/7/30일) 영향력 랭킹은 스펙 아웃, 실시간 헤드라인 + 국가 다중 선택 + 공평 배분으로 확정
  - 종목: 재무제표 필수 반영. 데이터 소스 조사 결과는 위 stocks 메모 참조 (Yahoo 한글 검색 거부, 회사망의 증권 사이트 차단, fundamentals-timeseries 우회)
  - 검증: KR/US 헤드라인 교차 배치, 삼성전자(005930.KS) 시세·차트·재무 12항목, QQQ ETF 검색, 즐겨찾기 저장

### 2026-06-11 (이어서, Sonnet)
- **TODO.md 작성**: 사용자가 제시한 12개(이후 14개) 향후 과제를 카드 UI/배치/앱 셸/계정 영역으로 정리. 마켓형 플러그인 전환 세부 과제도 별도 정리.
- **사내망 SSL 인터셉션으로 인한 빌드 앱 markets 버그 수정**: `npm run tauri build`로 만든 실제 앱에서 시장 지표가 "Unexpected token '<'" 에러로 실패. 원인은 `tauri-plugin-http`(reqwest) 기본 `rustls-tls`가 webpki-roots만 신뢰해 회사 자체 서명 루트 인증서를 검증 못 하고, catch로 넘어간 `/yahoo` 프록시 fallback도 production엔 없어 index.html을 받아옴. `Cargo.toml`에서 `rustls-tls-native-roots`(Windows 인증서 저장소 신뢰)로 전환해 해결. 사용자가 재빌드 후 정상 동작 확인.
- **헤더 더블클릭 최대화/복원 토글 추가**: `Dashboard.jsx`의 `handleMaximizeToggle` — 더블클릭한 카드를 다른 카드와 겹치지 않는 선에서 상하좌우 독립적으로 그리디 확장(각 방향은 현재 footprint와 겹치는 카드들의 가장 가까운 경계 또는 보드 끝까지). 인스턴스에 `_prev`(이전 x/y/w/h)를 저장해두고, 다시 더블클릭하면 복원. L자형 빈 공간까지 채우는 진짜 maximal-rectangle은 아니고 "현재 footprint 기준 독립 4방향 확장"이라는 단순화된 근사. `PluginCard`의 `.plugin-handle`에 `onDoubleClick` 연결.

### 2026-06-11 (이어서, Sonnet)
- **videoplayer 플러그인 추가**: 갑갑한 화면에서 자연 풍경 동영상으로 리프레시하자는 사용자 아이디어를 구현(상세는 위 구현 메모 참조). 신규 Tauri 인프라(fs/dialog 플러그인, asset 프로토콜, `protocol-asset` feature) 추가. 검증: `npm run build` ✅, `cargo check` ✅(신규 의존성 컴파일 포함, ~1m40s), 브라우저 프리뷰에서 "데스크탑 전용" 폴백 렌더 확인. 파일 다이얼로그/asset 재생 등 네이티브 경로는 `npm run tauri dev`에서 사용자 확인 필요.
- **videoplayer 동영상 목록 유실 버그 수정**: 사용자가 "동영상 추가 → 카드 닫음 → 다시 추가 → 목록이 비어있음" 보고. 원인은 동영상 목록을 인스턴스별 storage(`lifedash.plugin.<instanceId>`)에 저장했는데, 카드 제거 시 `clearPluginStorage`가 이 키를 통째로 지우기 때문. `storage.js`에 `createSharedStorage(pluginId)` 추가(키 `lifedash.shared.<pluginId>`, 인스턴스 생명주기와 무관) — videoplayer는 이제 동영상 목록을 여기에 저장. 검증: `npm run build` ✅, 브라우저 콘솔에서 인스턴스 storage 삭제 후에도 공유 storage가 남는 것 확인.

### 2026-06-12
- **시장지표/종목 시세 정체 버그 수정** (사용자 리포트: 코스피 1일 차트 안 그려짐, 삼성전자 가격이 어제값)
  - 원인 1: Yahoo KRX ~20분 지연 — 개장 직후 1d 차트 응답이 캔들 0개 (위 stocks 메모 참조)
  - 원인 2: stocks 플러그인에 자동 갱신이 없었음 — 종목 선택 시 1회 조회 후 영구 정체 (조회 실패 시 재시도도 없었음)
  - 수정: markets 1d→2d 폴백, stocks 60초 갱신 + 재클릭 재조회, 두 플러그인에 시세 기준 시각 표시
- **한국 시세 실시간화**: "20분 지연이라 어쩔 수 없냐"는 사용자 피드백에 재조사 → polling.finance.naver.com이 회사망에서 유일하게 차단 안 된 네이버 증권 호스트임을 발견, 한국 지수/종목 시세를 네이버 실시간으로 보정 (위 메모 참조). 검증: 코스피 8,413(+8.36%)·삼성전자 336,000(+12.37%) 실시간 표시, Yahoo만 쓸 때는 어제 종가(7,764/299,000)였음. 미국 종목은 Yahoo 경로 그대로.
- **앱 전체화면 토글 (F11)**: topbar 버튼 대신 **F11 키보드 단축키**로만 제공(사용자 요청으로 버튼 제거). 현재는 `desktop.js`의 `toggleFullscreen()`(Electron IPC / 브라우저 document fullscreen 분기).
- **browser(웹뷰) 플러그인 추가**: 월드컵 시청 등 "작게 틀어놓고 보고 싶은 임의 사이트"를 위한 범용 webview 플러그인. youtube/teams처럼 도메인 고정이 아니라 사용자가 주소창에 입력한 URL을 표시(위 "웹뷰 공통" 섹션 참조). 추가 capability/Cargo 변경 없이 기존 webview 권한 재사용. 검증: `npm run build` ✅(304.50 kB / gzip 95.45 kB), 브라우저 프리뷰에서 `.browser-root` 렌더·기본 URL(google.com)·데스크탑 전용 폴백 문구 확인, 콘솔 에러 없음.

### 2026-06-12 (이어서) — Electron 마이그레이션
- **결정 배경**: Tauri child webview의 z-order 문제(웹뷰가 드로어/카드를 뚫고 올라옴)는 OS 표면 구조상 근본 해결 불가. 사용자가 Codex와 Electron PoC(`electron-poc/`, MIGRATION.MD)로 `<webview>` 태그의 DOM 합성을 검증한 뒤 전체 마이그레이션 결정.
- **방식**: 프론트엔드(React/플러그인) 전부 재사용. Tauri API 호출부만 치환:
  - `useChildWebview`(rAF 추적 훅) → 삭제, `WebviewEmbed.jsx`(`<webview>` 한 줄)로 대체 — youtube/teams/browser
  - `plugin-http` 6곳 → `desktop.js`의 `desktopFetch`(IPC → main `net.fetch`)
  - `plugin-opener` → `openExternal`, `plugin-dialog`/`plugin-fs`/asset 프로토콜(videoplayer) → IPC + `media://` 프로토콜, 전체화면 → IPC
  - `vite.config.js`에 `base: "./"` (file:// 자산 경로, PoC 교훈)
- **함정 회피**: 메인 프로세스에서 Node fetch 대신 **Electron `net.fetch`** 사용 — Chromium 스택이라 OS 인증서를 신뢰해 사내망 SSL 인터셉션에서도 동작 (Node fetch였으면 Tauri 때 rustls-tls-native-roots 전환과 같은 문제 재발).
- **검증**: `npm run build` ✅(Tauri 청크 사라지고 단일 번들), 스모크 테스트 PASS(브리지/보드/IPC fetch, file:// production 경로), 브라우저 프리뷰에서 15종 플러그인 등록·시세 로드·새 폴백 문구 확인. **webview 카드 겹침/드로어 커버는 사용자가 `npm run electron:dev`로 최종 확인 필요.**
- **보존**: `src-tauri/`(레거시), `electron-poc/`(PoC), `@tauri-apps/*` JS deps는 devDependencies로 이동.

## 검증 방법 (다음 에이전트용)
1. **프론트만**: `npm run build` (수 초). UI 동작은 `npm run dev -- --port 1435`로 브라우저 확인 — **1430 쓰지 말 것, 끝나면 종료할 것**
2. **Electron 스모크 (창 안 띄움)**: `npm run build` 후 `$env:LIFEDASH_SMOKE='1'; npx electron .` — 숨김 창으로 부팅해 브리지/보드 렌더/IPC fetch(yahoo)를 자가진단하고 PASS/FAIL과 함께 종료. 렌더러 콘솔도 stdout으로 나옴. **production(file://) 경로 그대로 검증됨**
3. **화면이 필요한 기능(webview, 다이얼로그)**: `npm run electron:dev`가 필요한데 이건 사용자 포트(1430)를 쓰므로 **사용자에게 실행을 부탁**하는 게 안전
4. electron/main.cjs·preload.cjs 변경은 electron 재시작 필요 (renderer는 vite HMR 적용)

## 알려진 이슈 / 리스크
- [x] ~~youtube z-order: 웹뷰가 드로어/다른 카드를 가림~~ → **Electron 마이그레이션으로 근본 해결** (`<webview>`는 DOM 합성)
- [ ] **Electron 패키징 미구성**: electron-builder 등 배포 파이프라인은 아직 없음 (dev 실행만 가능). 필요 시 electron-builder + NSIS 추천
- [ ] **CSP 미설정**: dev 콘솔에 Electron 보안 경고 출력 (Tauri 시절에도 csp null). 패키징 전 index.html에 CSP 메타 추가 검토
- [ ] **AI 번역 실호출 미검증**: 키가 없어 에러 경로까지만 검증됨. 첫 사용 시 에러 나면 화면의 에러 메시지 확인
- [ ] **구글 gtx 비공식 엔드포인트**: translator/dictionary(영한)가 의존. 차단되면 DeepL Free 등으로 교체 (`engines.js` 추상화 지점 있음)
- [ ] **`.serena/` 디렉토리가 커밋돼 있음**: 코드 분석 도구 자동 생성물. 거슬리면 .gitignore 처리
- [ ] markets 목록 갱신은 32개 심볼을 순차 호출 — Yahoo가 rate limit 걸면 개별 실패는 조용히 스킵됨(설계상 의도)

## 미구현 / 향후 과제
- [ ] 플러그인 마켓 (검증된 플러그인 등록/배포 시스템) — 현재는 로컬 플러그인만
- [ ] 외부 플러그인 동적 로딩 (현재는 빌드 타임 번들. import.meta.glob이라 마켓 구현 시 로더 교체 필요)
- [ ] 윈도우 시작 시 자동 실행 (Electron: `app.setLoginItemSettings`)
- [ ] Electron 패키징/배포 (electron-builder)
- [ ] 멀티 보드(페이지) 지원
- [ ] 카드 z-order 관리 (클릭 시 맨 앞으로 등)
- [x] YouTube 임베드 — child webview로 구현 완료

## 개발 환경 설정
```powershell
# electron 바이너리 설치가 필요할 때만 (사내망 SSL)
$env:NODE_EXTRA_CA_CERTS = 'C:\LF_WIDE\bin\ssl_cert\dev_napi.lfmall.co.kr_2.cer'
npm install

npm run electron:dev        # 데스크탑 앱 (vite 1430 + electron 동시 기동)
npm run electron:start      # production 경로 (vite build 후 file://로 로드)
npm run dev -- --port 1435  # AI/검증용 브라우저 프리뷰
```

## 플러그인 런타임 설계 기준

현재 `src/plugins/*` 구조는 내장 플러그인 모델이다. `PluginRegistry.js`가 `import.meta.glob("../plugins/*/index.jsx", { eager: true })`로 플러그인을 빌드 시점에 수집하므로, 앱 실행 중 마켓에서 받은 JS 파일을 그대로 React 컴포넌트처럼 즉시 등록하는 구조가 아니다. 이 방식은 개발 속도와 기본 플러그인 유지에는 좋지만, 외부 개발자 생태계와 런타임 설치 모델에는 한계가 있다.

마켓형 플러그인을 목표로 할 때 핵심 맹점은 "JS 실행 가능 여부"가 아니라 "어떤 권한과 격리 수준으로 실행할 것인가"이다. 외부 JS를 메인 React 앱 컨텍스트에서 `import()`하거나 `<script>`로 실행하면 플러그인이 `localStorage`, DOM, 네트워크, 다른 플러그인 데이터에 접근할 수 있다. 이는 악성 플러그인뿐 아니라 버그가 있는 플러그인도 앱 전체를 망가뜨릴 수 있다는 뜻이다.

따라서 외부 플러그인은 다음 원칙을 기준으로 설계한다.

- 내장 플러그인은 현재 React 컴포넌트 방식으로 유지할 수 있다.
- 외부 마켓 플러그인은 별도 iframe 또는 Tauri WebView에서 실행하는 웹앱형 패키지로 다룬다.
- 앱 본체와 플러그인 사이의 연동은 직접 import가 아니라 `postMessage` 또는 제한된 bridge API로 처리한다.
- 플러그인의 네트워크, 저장소, 알림, 파일 접근 권한은 `manifest.json`에 선언하고 설치 시 사용자에게 보여준다.
- 플러그인별 저장소 namespace를 분리하고, 다른 플러그인 또는 앱 본체 데이터에 직접 접근하지 못하게 한다.
- 마켓 배포 단계에서는 플러그인 패키지 서명, 무결성 검증, 업데이트 시 권한 변경 감지가 필요하다.
- 외부 API 호출은 셸(Electron 메인 프로세스)의 검증과 플러그인 manifest 권한을 모두 통과해야 한다.

장기적으로 필요한 구조는 `내장 플러그인 런타임`과 `외부 플러그인 런타임`의 공존이다. 전자는 현재 MVP와 기본 위젯에 적합하고, 후자는 플러그인 마켓, 독립 배포, 서드파티 개발자 생태계에 적합하다.
