# lifedash-fable

플러그인 기반 개인 대시보드 데스크톱 앱입니다. 사용자는 시계, 타이머, 메모, TODO, 링크, 번역기, 사전, 시장 지표, AI 채팅, Teams, YouTube 같은 위젯형 플러그인을 자유롭게 추가하고 배치할 수 있습니다.

## 프로젝트 기본 정보

| 항목 | 내용 |
| --- | --- |
| 프로젝트명 | lifedash-fable |
| 버전 | 0.1.0 |
| 형태 | Tauri 기반 데스크톱 앱 |
| 주요 목적 | 자주 쓰는 생산성 도구와 외부 서비스를 하나의 개인 대시보드에서 관리 |
| 핵심 구조 | `src/plugins/<plugin>/index.jsx`와 `manifest.json` 기반 플러그인 자동 등록 |
| 기본 플러그인 | 시계, 타이머 |
| 지원 플러그인 | AI 채팅, 시계, 사전, 바로가기, 시장 지표, 메모, Teams, 타이머, TODO, 번역기, YouTube |
| 실행 환경 | Node.js, npm, Tauri |

## 사용된 기술

- Claude Code
- React 19
- Vite 7
- Tauri 2
- JavaScript ES Modules
- `@tauri-apps/api`
- `@tauri-apps/plugin-http`
- `@tauri-apps/plugin-opener`
- `react-draggable`
- `react-resizable`

## 실행

```powershell
npm install
npm run tauri dev
```

브라우저에서 프론트엔드만 확인할 때는 다음 명령을 사용합니다.

```powershell
npm run dev
```

## 빌드

```powershell
npm run build
npm run tauri build
```

## 참고

자세한 구조와 플러그인 작성 규칙은 [CLAUDE.md](./CLAUDE.md)를 참고합니다.
