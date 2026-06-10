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

## 미구현 / 향후 과제
- [ ] 플러그인 마켓 (검증된 플러그인 등록/배포 시스템) — 현재는 로컬 플러그인만
- [ ] 외부 플러그인 동적 로딩 (현재는 빌드 타임 번들)
- [ ] YouTube 등 외부 콘텐츠 임베드 — Tauri child webview API 검토 필요 (WebviewWindow는 별도 OS 창이라 부적합, lifedash 프로토타입에서 확인됨)
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
