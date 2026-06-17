# engexpr — English Expression Randomizer

## 개요
영어 회화 improvising을 위한 표현 랜덤 추천 플러그인. 구동사·문장구조·표현/관용어를 랜덤으로 5개 제시하며, 익숙한 표현은 풀에서 제외하고 북마크로 따로 모아둘 수 있다.

## 기능 명세

### 카드 레이아웃
- 가로로 긴 카드 5개를 세로 목록 형식으로 표시
- 각 카드 구성: type badge → 표현 → usage 설명(영어) → 예문
- 카드 우측: `[🔖] [↻]` 같은 행 + `[✓ Got it!]` 아래 행

### 표현 타입 및 색상
| Type | Badge 색 |
|------|---------|
| Phrasal Verb | 파랑 계열 |
| Sentence Structure | 초록 계열 |
| Expression | 보라 계열 |

### 툴바
- **⟳ Shuffle All**: 5개 카드 전체 재추첨
- **🔖 Bookmarks N**: 북마크 팝업 오픈
- **★ Familiar N**: Familiar 팝업 오픈

### 카드 액션
| 버튼 | 동작 |
|------|------|
| 🔖 | 해당 표현 북마크 토글 (활성 시 amber 색) |
| ↻ | 해당 슬롯만 재추첨 |
| ✓ Got it! | Familiar로 이동 → 해당 슬롯 자동 재추첨, 북마크에서도 제거 |

### Familiar
- Got it! 처리한 표현 목록. 랜덤 풀에서 제외됨
- ★ Familiar 팝업에서 확인 + ✕로 개별 삭제(풀로 복귀)
- 전부 Familiar 처리 시 "You've learned them all! 🎉" 표시

### Bookmarks
- 공부하고 싶은 표현을 모아두는 목록. 랜덤 풀에서 제외되지 않음
- 🔖 Bookmarks 팝업에서 확인 + ✕로 개별 삭제

### Settings (⚙)
카드 헤더 ⚙ 버튼 → 모달 오버레이

**Expression Pool 섹션**
- Base / AI-generated extras / Total 카운트 표시
- extraPool이 있을 때: "View pool ▼/▲" 토글 + "Clear all" (confirm 다이얼로그)
- View pool 펼치면 extraPool 항목 목록 + 항목별 ✕ 삭제 (confirm 다이얼로그)

**AI Provider 섹션**
- Claude / ChatGPT 선택
- API Key 입력 (password 타입)
- Model 입력 (자유 텍스트)
- **Generate 30 expressions** 버튼 → AI 호출 → id 기반 중복 제거 → 새것만 extraPool에 추가

## 데이터 구조

### 표현 항목
```js
{
  id: string,         // "pv-give-up" / "ss-not-only" / "ex-on-fence"
  type: "Phrasal Verb" | "Sentence Structure" | "Expression",
  expression: string,
  usage: string,      // 영어 한 문장, "When ..." 형식
  example: string,
}
```

### 저장소
| 키 | 저장소 | 내용 |
|----|--------|------|
| `familiar` | instanceStorage | familiar 처리된 id 배열 |
| `bookmarks` | instanceStorage | 북마크된 id 배열 |
| `extraPool` | instanceStorage | AI 생성 표현 객체 배열 |
| `aiProvider` | instanceStorage | "claude" \| "openai" |
| `aiKey` | instanceStorage | API 키 |
| `aiModel` | instanceStorage | 모델명 |

> 현재 instanceStorage 사용 중 — 기기 간 동기화 미지원 (tasks/TODO.md 데이터 동기화 항목 참조)

### 표현 풀 구성
`data.js` 기본 57개 + `extraPool` AI 생성분. id 기반 중복 제거 후 합산.

## AI 생성 로직 (`aiGen.js`)
- 기존 데이터를 AI에게 넘기지 않음 (토큰 절약)
- AI에게 30개 무차별 생성 요청
- id 패턴 규칙을 프롬프트에 명시해 구조화된 응답 유도
- 응답 파싱 후 기존 id와 대조, 중복 제거 → 새것만 extraPool에 병합
- Claude: `anthropic-dangerous-direct-browser-access` 헤더로 직접 호출
- OpenAI: Electron은 `desktopFetch`, 브라우저 dev는 `/openai` 프록시

## 파일 구조
```
src/plugins/engexpr/
  index.jsx     ← 메인 컴포넌트 + Settings (PluginCard ⚙ 패턴)
  data.js       ← 기본 57개 표현 (Phrasal Verb 20 / Sentence Structure 15 / Expression 22)
  aiGen.js      ← AI 호출 + 응답 파싱 + 중복 제거
  engexpr.css   ← 스타일
  manifest.json ← defaultSize: 480×560, minSize: 380×300
```

## 변경 이력

### 2026-06-17, Claude Sonnet 4.6
- 초기 구현: 카드 5개 세로 목록, type badge, ↻/✓ Got it!/★ Familiar
- Bookmarks 기능 추가 (🔖 버튼 + 팝업)
- usage 설명 필드 추가 (영어 한 문장)
- Settings(⚙): AI provider/key/model 설정 + Generate 30 expressions
- extraPool View 기능: 목록 토글 + 항목별 삭제 (confirm 포함) + Clear all (confirm 포함)
- 삭제 기능 이유: AI 생성 품질 낮은 항목 개별 제거 용도

## 데이터 확장 — 개발용 스크립트 (`scripts/gen-expressions.js`)

AI로 표현을 생성해 `data.js`에 직접 하드코딩으로 추가하는 Node.js 스크립트.

```powershell
node scripts/gen-expressions.js --key sk-ant-xxx
node scripts/gen-expressions.js --key sk-xxx --provider openai --count 50
```

**흐름**:
1. `data.js`에서 기존 id 읽기
2. AI(Claude/OpenAI)에 N개 생성 요청 — 기존 데이터는 넘기지 않음
3. 응답 파싱 후 기존 id와 대조, 중복 제거
4. 신규 표현만 `data.js` EXPRESSIONS 배열 끝에 삽입
5. `git diff`로 검수 후 커밋

**옵션**: `--key`, `--provider` (claude/openai), `--model`, `--count` (기본 30)

런타임 extraPool(Settings ⚙)과 역할 구분:
- 스크립트: 개발 시 시드 데이터 확장 → git 커밋으로 앱에 영구 반영
- extraPool: 사용자가 앱에서 직접 AI 호출로 추가 → localStorage 저장

## 향후 과제
- [ ] 데이터 동기화 (tasks/TODO.md 참조)
- [ ] 표현 타입 필터링 (구동사만 보기 등)
