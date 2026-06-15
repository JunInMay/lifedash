# lifedash-fable

플러그인 기반 개인 대시보드 데스크톱 앱입니다. 사용자는 시계, 타이머, 메모, TODO, 링크, 번역기, 사전, 시장 지표, AI 채팅, Teams, YouTube 같은 위젯형 플러그인을 자유롭게 추가하고 배치할 수 있습니다.

## 프로젝트 기본 정보

| 항목 | 내용 |
| --- | --- |
| 프로젝트명 | lifedash-fable |
| 버전 | 0.1.0 |
| 형태 | Electron 기반 데스크톱 앱 (Tauri에서 마이그레이션) |
| 주요 목적 | 자주 쓰는 생산성 도구와 외부 서비스를 하나의 개인 대시보드에서 관리 |
| 핵심 구조 | `src/plugins/<plugin>/index.jsx`와 `manifest.json` 기반 플러그인 자동 등록 |
| 기본 플러그인 | 시계, 타이머 |
| 지원 플러그인 | AI 채팅, 시계, 사전, 바로가기, 시장 지표, 메모, Teams, 타이머, TODO, 번역기, YouTube |
| 실행 환경 | Node.js, npm, Electron |

## 사용된 기술

| 분류 | 기술 | 버전/상태 | 용도 |
| --- | --- | --- | --- |
| 개발 도구 | Claude Code | 사용 | 구현 및 마이그레이션 작업 |
| 프론트엔드 | [[React(리액트)]] | 19 | 플러그인 기반 UI 구성 |
| 빌드 도구 | [[Vite(빌드 툴, Javascript)]] | 7 | 개발 서버 및 번들링 |
| 데스크톱 셸 | [[Electron]] | 31 | 데스크톱 앱 실행, `<webview>`, IPC 브리지 |
| 언어/모듈 | JavaScript ES Modules | 사용 | 앱 소스 모듈 시스템 |
| 카드 조작 | `react-draggable` | 4.6.0 | 플러그인 카드 드래그 |
| 카드 조작 | `react-resizable` | 4.0.1 | 플러그인 카드 리사이즈 |
| 레거시 | Tauri | 2 | Electron 마이그레이션 후 `src-tauri/` 보존 |
| 레거시 | `@tauri-apps/*` | devDependencies 보존 | 마이그레이션 이전 구현 참조 |

## 실행

```powershell
npm install        # 사내망에서 electron 설치 실패 시: $env:NODE_EXTRA_CA_CERTS 설정 (CLAUDE.md 참조)
npm run electron:dev
```

브라우저에서 프론트엔드만 확인할 때는 다음 명령을 사용합니다.

```powershell
npm run dev
```

## 빌드

```powershell
npm run electron:start   # production 경로로 바로 실행 (vite build + file:// 로드)
npm run dist             # 배포 빌드 → release/에 설치본(Setup) + 포터블 exe
```

> 2026-06-12 Tauri → Electron 마이그레이션 완료 (배경: [MIGRATION.MD](./tasks/MIGRATION.MD)). `src-tauri/`는 git 히스토리에만 보존.

## 참고

자세한 구조와 플러그인 작성 규칙은 [CLAUDE.md](./CLAUDE.md)를 참고합니다.
