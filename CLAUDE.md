# lifedash-fable

## 프로젝트 개요
개인화 가능한 대시보드 플랫폼. 빈 캔버스(칠판) 위에 플러그인을 자유롭게 배치해서 나만의 화면을 만드는 앱. 컴퓨터를 켰을 때 가장 먼저 켜는, 내게 필요한 도구와 정보만 모아 보는 대시보드.

- **컨셉**: "앱 위의 앱" — 플러그인 생태계 기반 개인 대시보드
- **비유**: 데스크탑 위의 가상 스마트폰. 앱스토어에서 앱 받아서 홈화면에 배치하는 UX
- **타겟**: 개인 사용자 (처음엔 혼자 쓸 용도, 이후 플러그인 마켓으로 오픈 생태계 확장)
- **계보**: `D:\VibeProjects\lifedash` 프로토타입의 기획을 이어받은 2세대 구현

## 기술 스택
- **Tauri v2** — 네이티브 데스크탑 앱 (Rust + WebView)
- **React 19** — 프론트엔드
- **Vite** — 빌드 도구
- **react-draggable** — 플러그인 카드 드래그
- **react-resizable** — 플러그인 카드 리사이징

## 구조

```
src/
  core/
    PluginRegistry.js   ← import.meta.glob 기반 플러그인 자동 발견
    Dashboard.jsx       ← 칠판: 인스턴스 추가/제거/배치 관리
    PluginCard.jsx      ← 드래그/리사이즈/닫기 카드 셸
    PluginDrawer.jsx    ← "+ 플러그인" 추가 패널
    eventBus.js         ← 플러그인 간 pub/sub 이벤트 버스
    storage.js          ← 레이아웃 + 플러그인별 네임스페이스 저장소
  plugins/
    <plugin-dir>/
      index.jsx         ← 플러그인 컴포넌트 (default export)
      manifest.json     ← 메타데이터
```

## 플러그인 시스템

### 설계 원칙
- **칠판(Dashboard)**이 플러그인의 위치/크기/생명주기를 관리
- **플러그인**은 자기 내부 데이터만 관리 (위치는 모름)
- 같은 플러그인을 여러 개 배치 가능 (인스턴스 단위, `instanceId`로 구분)
- 플러그인 폴더만 만들면 자동 등록 — 레지스트리에 코드 추가 불필요

### 플러그인 작성법
`src/plugins/<dir>/` 아래 두 파일만 만들면 끝:

**manifest.json**
```json
{
  "id": "todo",
  "name": "할 일",
  "icon": "✅",
  "description": "체크리스트",
  "version": "1.0.0",
  "defaultSize": { "w": 300, "h": 320 },
  "minSize": { "w": 240, "h": 200 }
}
```
- `defaultSize` / `minSize`는 **픽셀 단위**
- `id`는 레지스트리 키 — 폴더명과 일치 권장

**index.jsx** — default export 컴포넌트. 받는 props:

| prop | 설명 |
|------|------|
| `instanceId` | 이 인스턴스의 고유 ID |
| `storage` | 인스턴스 전용 저장소 `{ get(key, fallback), set(key, value), remove(key) }` |
| `bus` | 이벤트 버스 `{ on(event, handler) → unsubscribe, emit(event, payload) }` |
| `width` / `height` | 현재 카드 크기 (px) |

이벤트 이름 컨벤션: `"<pluginId>:<event>"` 예) `"timer:reset"`

### 저장소 키 구조 (localStorage)
- `lifedash.layout` — 인스턴스 배열 `[{ instanceId, pluginId, x, y, w, h }]`
- `lifedash.plugin.<instanceId>` — 플러그인 인스턴스별 데이터. 인스턴스 제거 시 함께 삭제됨

## 현재 구현된 플러그인
| id | 이름 | 비고 |
|----|------|------|
| `clock` | 시계 | 시각 + 날짜 |
| `timer` | 타이머 | 밀리초 스톱워치 (Date.now 기반이라 탭 스로틀에도 정확) |
| `todo` | 할 일 | storage 사용 |
| `notes` | 메모 | storage 사용, 입력 즉시 저장 |
| `links` | 바로가기 | `@tauri-apps/plugin-opener`로 기본 브라우저 열기, 브라우저 환경은 `window.open` fallback |
| `markets` | 시장 지표 | 코스피·나스닥·VIX·유가 등 32개 지표. 좌측 차트(1일/1주/1개월/1년) + 우측 목록 클릭 전환 |
| `youtube` | 유튜브 | Tauri child webview로 진짜 youtube.com을 카드 위에 표시. 데스크탑 앱 전용 (브라우저 dev는 안내만) |
| `translator` | 번역기 | 하이브리드 엔진: 기본은 무료 구글 번역(키 불필요), 설정(⚙)에 Claude API 키 입력 시 AI 번역 |
| `dictionary` | 사전 | 영영(Free Dictionary API) + 영한(구글 dt=bd). 좌측 뜻풀이, 우측 검색 기록 클릭 재조회 |

### dictionary 플러그인 데이터 소스
- **영영**: `api.dictionaryapi.dev/api/v2/entries/en/{word}` — 키 불필요. 발음기호(IPA), 오디오, 품사별 정의/예문/유의어. 404 = 단어 없음.
- **영한**: 번역기와 같은 구글 엔드포인트에 `dt=bd` 파라미터 추가 — `json[1]`에 품사별 대역어 목록이 옴(`tl=ko`라 품사명도 한국어). `json[0]`은 대표 번역.
- 검색 기록은 인스턴스 storage에 `{word, mode}`로 최대 30개. 성공한 검색만 기록.
- 브라우저 dev 프록시: `/dict`(dictionaryapi.dev), `/gtx`(구글 공용). Tauri capability에 두 도메인 등록됨.

### translator 플러그인 엔진 구조
- 엔진 추상화는 `src/plugins/translator/engines.js`의 `translate({engine, ...})` 한 곳. 엔진 추가(DeepL 등) 시 여기만 수정.
- **google**: 비공식 무료 엔드포인트 `translate.googleapis.com/translate_a/single?client=gtx`. 키 불필요, 언어 자동 감지 지원. 비공식이라 차단 리스크 있음.
- **claude**: Anthropic Messages API 직접 호출. 키는 플러그인 storage(localStorage)에만 저장. 모델 선택 가능(기본 `claude-haiku-4-5`, Sonnet/Opus 선택지). 브라우저 CORS는 `anthropic-dangerous-direct-browser-access: true` 헤더로 허용.
- 네트워크 경로는 markets와 동일 패턴: Tauri는 plugin-http(capability에 도메인 등록), 브라우저 dev는 vite 프록시(`/gtx`).

### youtube 플러그인 동작 방식 (child webview)
- 유튜브는 iframe 차단(X-Frame-Options)이라 embed로는 페이지 탐색이 불가 → **Tauri child webview**로 해결.
  (lifedash 프로토타입의 `WebviewWindow` 방식은 별도 OS 창이 떠서 실패했던 과제)
- Rust: `tauri = { features = ["unstable"] }` 필요 (한 윈도우 안 멀티 웹뷰). capability에 `core:webview:allow-create-webview` 등 4개 권한 등록됨.
- JS: `new Webview(getCurrentWindow(), label, { url, x, y, width, height })` 생성 후,
  카드 본문 DOM의 `getBoundingClientRect()`를 rAF 루프로 추적해 `setPosition`/`setSize`로 따라붙임.
- **제약**: 네이티브 웹뷰는 항상 HTML 위에 떠 있음. 다른 카드나 플러그인 드로어가 유튜브 카드와 겹치면 웹뷰에 가려진다. 유튜브 카드는 구석에 두는 걸 권장.
- StrictMode 이중 마운트 대비, 웹뷰 라벨은 마운트마다 고유값 생성. 언마운트 시 `close()`로 정리.

### markets 플러그인 데이터 소스
- **Yahoo Finance v8 chart API** (무료, 키 불필요): `query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- CORS 우회 2중화 (`src/plugins/markets/api.js`):
  - Tauri 앱: `tauri-plugin-http` (Rust 측 fetch) — capability에 yahoo URL 허용 등록됨
  - 브라우저 dev: vite 프록시 `/yahoo` (사내망 SSL 인터셉션 때문에 `secure: false` 필수)
- 지표 추가/제거는 `src/plugins/markets/symbols.js`만 수정
- 갱신 주기: 선택 지표 60초, 목록 등락률은 400ms 간격 순차 순회 후 3분 휴식 (API 부하 분산)
- 등락 색상은 국내 관례 (상승 빨강 / 하락 파랑)

## 미구현 / 향후 과제
- [ ] 플러그인 마켓 (검증된 플러그인 등록/배포 시스템) — 현재는 로컬 플러그인만
- [ ] 외부 플러그인 동적 로딩 (현재는 빌드 타임 번들)
- [x] YouTube 임베드 — child webview로 구현 완료 (위 youtube 플러그인 참고)
- [ ] youtube 웹뷰가 드로어/다른 카드를 가리는 z-order 문제 — 드로어 열릴 때 웹뷰 hide 등 검토
- [ ] 윈도우 시작 시 자동 실행 (autostart 플러그인)
- [ ] 멀티 보드(페이지) 지원

## 개발 환경 설정
```powershell
# SSL 인증서 이슈 우회 (Windows)
$env:CARGO_HTTP_CHECK_REVOKE = "false"
npm run tauri dev
```
- dev 서버 포트: **1430** (원본 lifedash가 1420을 쓰므로 충돌 방지)
- 프론트만 빠르게 볼 때: `npm run dev` (Tauri 전용 API는 fallback 동작)
