# Logger — 로깅 시스템 명세

## 개요

앱 전체에서 사용하는 통합 로거. 브라우저 콘솔 출력과 Electron 파일 로그를 동시에 처리한다.

## 구성 파일

| 파일 | 역할 |
|------|------|
| `src/core/logger.js` | 렌더러용 로거 API (`log`, `logAction`) |
| `electron/main.cjs` | `electron-log` 초기화 + `log:write` IPC 핸들러 |
| `electron/preload.cjs` | `window.lifedash.logWrite()` 브리지 노출 |

## API

### `log` — 레벨별 로그

```js
import { log } from "@/core/logger";

log.debug("msg", { key: val });  // 상세 디버그 (버스 이벤트 등)
log.info("msg", data?);          // 일반 정보
log.warn("msg", data?);          // 경고
log.error("msg", data?);         // 에러
```

### `logAction` — 사용자 액션 전용

사용자가 앱에서 직접 클릭하거나 입력한 행동을 기록한다. API 호출, 내부 상태 변경, 버스 이벤트 같은 시스템 동작과 구분하기 위해 별도 함수로 분리했다.

```js
import { logAction } from "@/core/logger";

logAction("plugin:add", { pluginId, instanceId });
```

파일에 `[ACTION]` 접두어로 기록되므로, 시스템 로그와 섞인 파일에서 사용자 행동만 grep으로 추출할 수 있다.

## 로그 파일

**위치**: `%APPDATA%\lifedash-fable\logs\main.log`

**포맷**: `[2026-06-17 14:32:01.123] [info] 메시지 {data}`

**로테이션**: 최대 5MB × 5개 (자동, electron-log 기본)

**확인 방법**:
```powershell
# 전체 최근 50줄
Get-Content "$env:APPDATA\lifedash-fable\logs\main.log" -Tail 50

# 액션 로그만
Select-String "\[ACTION\]" "$env:APPDATA\lifedash-fable\logs\main.log"

# 에러만
Select-String "\[error\]" "$env:APPDATA\lifedash-fable\logs\main.log"
```

## 환경별 동작

| 환경 | 콘솔 출력 | 파일 기록 |
|------|----------|----------|
| Electron 앱 | ✅ | ✅ (`window.lifedash.logWrite` IPC 경유) |
| 브라우저 dev (1435) | ✅ | ❌ (`window.lifedash` 없음, 조용히 skip) |

## 기록되는 이벤트

| 위치 | 이벤트 | 레벨 |
|------|-------|------|
| `main.cjs` 시작 | `app start` | info |
| `Dashboard.jsx` | `dashboard loaded` (인스턴스 수) | info |
| `Dashboard.jsx` | `[ACTION] plugin:add` | info |
| `Dashboard.jsx` | `[ACTION] plugin:remove` | info |
| `eventBus.js` | `[bus] <event>` (모든 emit) | debug |
| `eventBus.js` | 핸들러 에러 | error |

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-17 | 초기 구현 — electron-log 파일 로그 + 렌더러 IPC 브리지 + Dashboard/eventBus 로깅 |
