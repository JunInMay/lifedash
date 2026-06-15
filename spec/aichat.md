# aichat 플러그인 스펙

## 개요
- **id**: `aichat`
- **이름**: AI 채팅
- **목적**: 영어 회화 연습용 채팅 파트너. Claude(Anthropic) / GPT(OpenAI) 중 선택해 대화하고, 사용자의 영어 실수를 짧게 교정해주는 시스템 프롬프트가 기본값.
- **위치**: `src/plugins/aichat/`

## 파일 구성
| 파일 | 역할 |
|------|------|
| `manifest.json` | 메타데이터 (id/name/icon/defaultSize/minSize) |
| `index.jsx` | UI 컴포넌트 — 헤더(provider 선택/모델 표시/지우기/설정), 설정 패널, 메시지 목록, 입력행 |
| `api.js` | provider 추상화 (`sendChat`), Claude/OpenAI 호출 구현, 기본 시스템 프롬프트 |
| `aichat.css` | 채팅 버블/입력행 스타일 |

## 기능 명세

### Provider
- `PROVIDERS` (api.js): `claude`(기본 모델 `claude-haiku-4-5`), `openai`(기본 모델 `gpt-5-mini`)
- 모델은 select가 아닌 **자유 입력 텍스트**(모델 단종 대비). placeholder로 모델명 예시 힌트 제공.
- provider/모델/API 키는 모두 provider별로 분리해 storage에 저장:
  - `provider`: 현재 선택된 provider id
  - `keys`: `{ claude: "...", openai: "..." }`
  - `models`: `{ claude: "...", openai: "..." }` (비어있으면 `defaultModel` 사용)

### 시스템 프롬프트
- `DEFAULT_SYSTEM` (api.js): 영어 회화 파트너 역할. 짧은 답변(1~3문장) + 영어 실수 시 괄호로 짧게 교정 후 대화 이어가기.
- 설정(⚙) 패널의 textarea에서 자유롭게 수정 가능, `system` 키로 storage 저장.

### 대화 흐름
- 메시지: `{ role: "user" | "assistant", content: string }[]`
- storage 키 `messages`에 영속, 최대 `HISTORY_MAX = 100`개까지만 보관(오래된 것부터 제거)
- API 전송 시에는 최근 `SEND_WINDOW = 20`개만 보냄 (요청 비대화 방지)
- 입력란은 `<textarea>`(자동 높이 조절): 한 줄 입력 시 단일 행 높이, 텍스트가 길어지면 `INPUT_MAX_HEIGHT(120px)`까지 높이가 늘어나고, 그 이상은 내부 스크롤로 전환. Enter로 전송, Shift+Enter로 줄바꿈
- 입력란 높이가 늘어날 때 메시지 목록은 `flex: 1 1 auto`로 줄어들고 자체 스크롤을 유지한다. 입력 영역이 마지막 메시지를 덮으면 안 되므로 `.plugin-body`/`.chat-root`는 `min-height: 0`과 padding 포함 높이 계산(`box-sizing: border-box`)을 유지해야 한다.
- "전송" 버튼으로도 전송. 전송 중(`busy`)에는 입력 비활성화 + "..." 로딩 버블 표시
- "🗑" 버튼으로 대화 전체 삭제(`messages` 초기화, 에러도 클리어)
- 새 메시지/busy 변경 시 메시지 목록 자동 스크롤(맨 아래로)

### API 호출 (api.js)
- **공통 패턴**: `isDesktop() ? desktopFetch(절대URL) : fetch(상대/프록시URL)` — CLAUDE.md의 "외부 API 호출 공통 패턴" 준수
- **Claude**: `https://api.anthropic.com/v1/messages` 직접 호출. `anthropic-dangerous-direct-browser-access: true` 헤더로 브라우저 CORS 우회. `system` + `messages` 전달, 응답의 `content[].text`를 합쳐 반환
- **OpenAI**: 브라우저 dev는 `/openai/v1/chat/completions` (vite 프록시), Electron은 `desktopFetch`로 `https://api.openai.com/v1/chat/completions` 직접 호출. `system` 메시지를 messages 배열 맨 앞에 추가
- API 키가 없으면 호출 전에 `"설정(⚙)에서 API 키를 입력해주세요."` 에러를 던짐 (실제 API 호출 없이 즉시 실패)
- 에러 시 `error.message` 또는 `HTTP {status}` 형태로 메시지 구성, UI 하단에 빨간 텍스트로 표시

### 보안/저장
- API 키는 **인스턴스 storage(localStorage)에만 저장** — 서버 전송 없음, 사용자가 직접 키 입력 시에만 사용
- "이 PC의 로컬 저장소에만 저장됩니다" 안내 문구를 설정 패널에 표시

## 알려진 이슈 / 미검증
- AI 번역(translator) 플러그인과 동일한 Claude 호출 경로를 쓰지만, **실제 키로 검증된 적은 없음** (CLAUDE.md "알려진 이슈/리스크" 참조). 처음 사용 시 에러가 나면 화면의 에러 메시지를 먼저 확인.
- OpenAI 경로는 무효 키로 401 왕복까지만 검증됨 (2026-06-10).

## 변경 이력
- **2026-06-10 (Sonnet)**: 최초 구현. Claude/GPT 듀얼 provider, 영어 회화 시스템 프롬프트 기본값, 대화 storage 영속. 검증: 무효 키로 OpenAI 401 왕복, provider 전환/설정 저장, 버블 UI 렌더.
- **2026-06-15 (Sonnet)**: 입력란을 `<input>` → 자동 높이 조절 `<textarea>`로 교체 (ChatGPT/Claude 데스크탑처럼 텍스트가 길어지면 입력란이 늘어나고, `INPUT_MAX_HEIGHT(120px)` 이상은 스크롤). Enter 전송/Shift+Enter 줄바꿈으로 변경. 검증: 브라우저 프리뷰에서 8줄 입력 시 120px까지 늘어나고 스크롤 전환(`scrollHeight 185 > clientHeight 118`) 확인, 비우면 원래 높이로 복귀.
- **2026-06-15 (Codex)**: 자동 높이 입력란이 커질 때 메시지 목록을 덮어 마지막 응답이 보이지 않던 레이아웃 버그 수정. `.plugin-body`와 aichat flex 컨테이너의 `min-height`/`overflow`/`box-sizing`을 보정해 입력행은 아래에 고정되고 `.chat-msgs`가 줄어들며 스크롤되도록 변경. 검증: `npm run build` 통과.

## 향후 과제 (논의 필요)
- [ ] DeepL 등 추가 provider — translator의 `engines.js`처럼 추상화 지점은 이미 있음(`PROVIDERS` 배열 + `sendChat` 분기 추가)
- [ ] 대화 내보내기/초기화 외 "여러 대화방(세션)" 지원 여부
- [ ] 응답 스트리밍(SSE) 지원 여부 — 현재는 단일 응답을 기다림
