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
| 빌드 상태 | `npm run build` ✅ / `cargo check` ✅ / 데스크탑 앱 실행은 사용자가 수시로 `npm run tauri dev`로 확인 |

### ⚠️ 환경 특이사항 (모르면 헤맨다)
1. **사내망 SSL 인터셉션**: 이 PC는 회사망이라 HTTPS가 자체 서명 인증서로 가로채진다.
   - Node(vite 프록시)에서 외부 HTTPS 호출 시 `self-signed certificate in certificate chain` 에러 → vite 프록시에 `secure: false` 필수 (이미 적용됨)
   - cargo는 `$env:CARGO_HTTP_CHECK_REVOKE = "false"` 설정 후 실행 (안 하면 crates.io 접근 실패)
   - 브라우저/웹뷰의 fetch는 OS가 사내 루트 인증서를 신뢰하므로 영향 없음
2. **포트 규칙 (중요, 사용자가 직접 지시함)**:
   - **1430** = `npm run tauri dev` 전용. **AI 에이전트가 검증용으로 점거하면 절대 안 됨** (실제로 충돌 사고 2회)
   - **1435** = AI 검증용 프리뷰 포트. `npm run dev -- --port 1435`로 실행 (`.claude/launch.json`에 설정돼 있음)
   - 검증이 끝나면 반드시 dev 서버를 종료하고, 고아 node 프로세스가 포트를 물고 있지 않은지 `Get-NetTCPConnection -LocalPort <port> -State Listen`으로 확인
3. **cargo 첫 빌드는 10~15분** 걸린다 (의존성 ~400 크레이트). `src-tauri/target`(약 2.7GB)이 캐시이므로 지우지 말 것. 캐시가 있으면 cargo check는 수 초.
4. **localStorage는 origin별**: 1430(사용자 실사용), 1435(검증용), tauri 앱은 각각 별도 저장소다. 1435에서 테스트로 만든 레이아웃은 사용자 화면에 안 나타난다.
5. Windows + PowerShell 환경. git이 CRLF 경고를 내지만 무해.

## 기술 스택
- **Tauri v2** — 네이티브 데스크탑 앱 (Rust + WebView). `unstable` feature 활성화됨 (child webview용)
- **React 19** — 프론트엔드
- **Vite 7** — 빌드 도구
- **react-draggable / react-resizable** — 카드 드래그/리사이징
- **@tauri-apps/plugin-http** — Rust 측 HTTP (웹뷰 CORS 우회)
- **@tauri-apps/plugin-opener** — 기본 브라우저로 URL 열기

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
      *.js / *.css      ← 부속 파일 자유 (registry는 index.jsx/manifest.json만 본다)
src-tauri/              ← Rust 셸. capabilities/default.json에 권한/허용 도메인
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

### 외부 API 호출 공통 패턴 (CORS 이중화)
모든 네트워크 플러그인이 같은 패턴을 쓴다 (`markets/api.js`, `translator/engines.js`, `dictionary/api.js`):
- **Tauri 앱**: `@tauri-apps/plugin-http`의 fetch로 직접 호출 (CORS 없음). 도메인을 `src-tauri/capabilities/default.json`의 `http:default` allow 목록에 등록해야 함
- **브라우저 dev**: vite 프록시 경유 (`vite.config.js`의 `server.proxy`, 전부 `secure: false`)

| 프록시 | 대상 | 사용 플러그인 |
|--------|------|---------------|
| `/yahoo` | query1.finance.yahoo.com | markets |
| `/gtx` | translate.googleapis.com | translator, dictionary(영한) |
| `/dict` | api.dictionaryapi.dev | dictionary(영영) |
| (직접) | api.anthropic.com | translator(AI) — `anthropic-dangerous-direct-browser-access` 헤더로 브라우저 CORS 허용 |

새 외부 API 추가 시: vite 프록시 1개 + capability allow 1줄 + 이중 경로 fetch 래퍼.

## 구현된 플러그인

| id | 이름 | 핵심 | 데이터 소스 |
|----|------|------|------------|
| `clock` | 시계 | 시각+날짜 | - |
| `timer` | 타이머 | 밀리초 스톱워치, Date.now 기반 | - |
| `todo` | 할 일 | storage 영속 | - |
| `notes` | 메모 | 입력 즉시 저장 | - |
| `links` | 바로가기 | 기본 브라우저로 열기(opener), 브라우저 dev는 window.open fallback | - |
| `markets` | 시장 지표 | 32개 지표, 좌측 SVG 차트(1일/1주/1개월/1년) + 우측 목록 클릭 전환 | Yahoo Finance v8 chart API (무키) |
| `youtube` | 유튜브 | child webview로 진짜 youtube.com을 카드 위에 표시 | - (데스크탑 전용) |
| `translator` | 번역기 | 하이브리드: 무료 구글 기본, Claude API 키 입력 시 AI 번역 | 구글 gtx / Anthropic Messages API |
| `dictionary` | 사전 | 영영/영한, 좌측 뜻풀이 + 우측 검색 기록 재조회 | dictionaryapi.dev / 구글 gtx `dt=bd` |
| `teams` | 팀즈 | child webview로 진짜 teams.microsoft.com을 카드 위에 표시 (youtube와 동일 패턴) | - (데스크탑 전용) |

### 플러그인별 구현 메모

**markets** — 지표 추가/제거는 `symbols.js`만 수정. 선택 지표 60초 갱신, 목록 등락률은 400ms 간격 순차 순회 후 3분 휴식(API 부하 분산). 등락 색상은 국내 관례(상승 빨강/하락 파랑). 차트는 의존성 없는 순수 SVG(`Chart.jsx`, ResizeObserver로 크기 추적).

**youtube** — 유튜브는 iframe 차단(X-Frame-Options)이라 **Tauri child webview**로 해결 (원본 lifedash가 WebviewWindow로 실패했던 과제. 별도 OS 창이 떠버림). 구현:
- Rust: `tauri = { features = ["unstable"] }` (멀티 웹뷰 필수) + capability에 `core:webview:allow-create-webview` 등 4개 권한
- JS: `new Webview(getCurrentWindow(), label, { url, x, y, width, height })` 생성 후, 카드 본문 DOM의 `getBoundingClientRect()`를 rAF 루프로 추적해 `setPosition`/`setSize`로 따라붙임
- StrictMode 이중 마운트 대비 웹뷰 라벨은 마운트마다 고유값. 언마운트 시 `close()`
- **제약**: 네이티브 웹뷰는 항상 HTML 위에 떠 있어 다른 카드/드로어가 겹치면 가려짐. 브라우저 dev에서는 동작 안 함(안내 문구만 표시)

**translator** — 엔진 추상화는 `engines.js`의 `translate({engine, ...})` 한 곳. DeepL 등 추가 시 여기만 수정. Claude 모델 선택지: `claude-haiku-4-5`(기본), `claude-sonnet-4-6`, `claude-opus-4-8`. API 키는 인스턴스 storage(localStorage)에만 저장.

**dictionary** — 영한은 구글 gtx에 `dt=bd` 추가 시 `json[1]`에 품사별 대역어가 옴(`tl=ko`라 품사명도 한국어로 옴). 검색 기록은 `{word, mode}` 최대 30개, 성공한 검색만 기록.

**teams** — youtube 플러그인을 그대로 복제해 URL만 `teams.microsoft.com`으로 교체. 추가 capability/proxy 불필요(웹뷰 생성은 도메인 제한 없음, CSP가 null). 매번 로그인해도 무방하다는 사용자 확인 하에 진행. youtube와 동일한 z-order/브라우저 dev 제약을 그대로 가짐.

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

### 2026-06-10 (이어서)
- **teams 플러그인 추가**: youtube와 동일한 child webview 패턴, `teams.microsoft.com` 임베드. 사용자가 데스크탑 앱에서 로그인까지 정상 동작 확인.
- **PluginCard 리사이즈 핸들 NW/NE 추가**: SE만 있던 기본 핸들에 좌상/우상 추가 (`resizeHandles={["se","ne","nw"]}`). youtube/teams처럼 child webview가 카드 본문(`.plugin-body`) 전체를 덮어 SE 핸들이 가려지는 문제의 우회책 — 헤더 영역(웹뷰가 안 덮는 곳)에 핸들을 추가. NW/NE로 리사이즈하면 카드 좌상단 기준점이 이동하므로, `onResizeStart`에서 시작 위치/크기를 기록하고 핸들 방향(`n`/`w` 포함 여부)에 따라 위치(x, y)도 함께 보정. 사용자가 동작 확인 완료.
- 알아둘 점: SW 핸들은 추가 안 함(아직 가려짐 문제 미해결 — 필요 시 webview hide 연동 검토, [알려진 이슈](#알려진-이슈--리스크) 참조)

## 검증 방법 (다음 에이전트용)
1. **프론트만**: `npm run build` (수 초). UI 동작은 `npm run dev -- --port 1435`로 브라우저 확인 — **1430 쓰지 말 것, 끝나면 종료할 것**
2. **Rust 변경 시**: `$env:CARGO_HTTP_CHECK_REVOKE = "false"; cargo check` (src-tauri에서). capability JSON 오류도 여기서 잡힘
3. **네이티브 전용 기능(youtube, plugin-http 실호출)**: `npm run tauri dev`가 필요한데 이건 사용자 포트(1430)를 쓰므로 **사용자에게 실행을 부탁**하는 게 안전
4. MyBatis식 hot reload 없음 — vite는 HMR 되지만 tauri.conf.json/Cargo.toml/capability 변경은 tauri dev 재시작 필요

## 알려진 이슈 / 리스크
- [ ] **youtube z-order**: 웹뷰가 드로어/다른 카드를 가림. 드로어 열릴 때 `webview.hide()` 등 검토 (eventBus로 드로어 open 이벤트 쏘면 됨)
- [ ] **AI 번역 실호출 미검증**: 키가 없어 에러 경로까지만 검증됨. 첫 사용 시 에러 나면 화면의 에러 메시지 확인
- [ ] **구글 gtx 비공식 엔드포인트**: translator/dictionary(영한)가 의존. 차단되면 DeepL Free 등으로 교체 (`engines.js` 추상화 지점 있음)
- [ ] **`.serena/` 디렉토리가 커밋돼 있음**: 코드 분석 도구 자동 생성물. 거슬리면 .gitignore 처리
- [ ] markets 목록 갱신은 32개 심볼을 순차 호출 — Yahoo가 rate limit 걸면 개별 실패는 조용히 스킵됨(설계상 의도)

## 미구현 / 향후 과제
- [ ] 플러그인 마켓 (검증된 플러그인 등록/배포 시스템) — 현재는 로컬 플러그인만
- [ ] 외부 플러그인 동적 로딩 (현재는 빌드 타임 번들. import.meta.glob이라 마켓 구현 시 로더 교체 필요)
- [ ] 윈도우 시작 시 자동 실행 (tauri-plugin-autostart)
- [ ] 멀티 보드(페이지) 지원
- [ ] 카드 z-order 관리 (클릭 시 맨 앞으로 등)
- [x] YouTube 임베드 — child webview로 구현 완료

## 개발 환경 설정
```powershell
# SSL 인증서 이슈 우회 (사내망)
$env:CARGO_HTTP_CHECK_REVOKE = "false"
npm run tauri dev          # 데스크탑 앱 (포트 1430)
npm run dev -- --port 1435 # AI/검증용 브라우저 프리뷰
```
