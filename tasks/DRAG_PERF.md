# 드래그 성능 문제 분석 및 해결 (2026-06-18)

## 증상

집 PC(회사 노트북 대비 저사양)에서 카드 드래그 시 두 가지 문제 발생:

1. **전반적 반응 지연** — 드래그가 느리게 따라옴
2. **커서 디싱크** — 조금만 빠르게 움직이면 마우스 커서가 카드보다 앞서 나가버림

## 원인 1: 형제 카드 불필요 리렌더

`onDrag` → `setPos` → `PluginCard` 리렌더 시, Dashboard의 모든 형제 카드도 같이 리렌더됨.

- `handleMove`, `handleResize`, `handleRemove`, `handleMaximizeToggle`이 매 렌더마다 새 함수로 생성됨
- React는 prop이 바뀐 것으로 판단해 모든 `PluginCard`를 재렌더
- 카드가 많을수록 선형으로 느려짐

**수정**: `PluginCard`를 `React.memo`로 감싸고, Dashboard의 콜백 4개를 `useCallback` + 함수형 `setInstances`로 변경해 참조 안정화.

## 원인 2: Controlled mode의 구조적 한계 (커서 디싱크의 근본 원인)

react-draggable의 **controlled mode** (`position={pos}` prop 사용) 구조:

```
마우스 이동 → onDrag 콜백 → setPos(state 업데이트) → React 렌더 → DOM transform 적용
```

마우스 이벤트와 DOM 반영 사이에 React 렌더 사이클이 끼어들어 항상 한 프레임 이상 지연됨.
PC 성능이 낮을수록 렌더 시간이 길어져 커서와 카드의 간격이 벌어짐.

**수정**: **uncontrolled mode** (`defaultPosition` prop)로 전환.

```
마우스 이동 → react-draggable이 CSS transform 직접 조작 (React 렌더 없음)
드래그 종료(onStop) → onMove 호출 → Dashboard state 업데이트 (1회만)
```

드래그 중 React가 전혀 개입하지 않으므로 커서와 카드가 완벽히 동기화됨.

## 외부 좌표 변경(정렬/최대화) 처리

uncontrolled mode에서 "정렬 버튼"이나 "더블클릭 최대화"처럼 외부에서 좌표가 바뀌면,
react-draggable 내부 상태가 갱신되지 않아 다음 드래그 시 이전 위치로 점프하는 문제가 생김.

**해결**: `syncKey` + `lastDragPos` ref 패턴

- `lastDragPos` ref: 드래그 `onStop`에서 마지막으로 멈춘 위치를 기록
- `instance.x/y`(Dashboard state)가 `lastDragPos`와 다르면 → 외부 변경으로 판단
- `syncKey`를 +1 → `<Draggable key={syncKey} defaultPosition={...}>` 재초기화
- 드래그 자신이 업데이트한 좌표는 `lastDragPos`와 일치하므로 syncKey가 올라가지 않음

## NW/NE 리사이즈 위치 보정

uncontrolled 전환 후 리사이즈 핸들(NW/NE)의 위치 보정 로직도 수정 필요.

기존: `pos` state에서 현재 카드 위치를 읽음
변경: `nodeRef.current.style.transform`을 파싱해 실제 DOM 위치를 읽음

```js
const style = nodeRef.current?.style.transform ?? "";
const match = style.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
const curX = match ? parseFloat(match[1]) : instance.x;
const curY = match ? parseFloat(match[2]) : instance.y;
```

## 원인 3: GPU 레이어 미승격 (합성 병목)

uncontrolled mode 전환 후에도 드래그 지연이 남아있던 원인.

`.plugin-card-wrap`에 `will-change: transform`이 없으면 브라우저가 드래그 중 매 프레임마다 카드를 포함한 레이어를 CPU에서 다시 합성함. 저사양 PC에서 이 합성 비용이 병목이 됨.

**수정**: `src/App.css`의 `.plugin-card-wrap`에 `will-change: transform` 추가. 브라우저가 해당 요소를 별도 GPU 컴포지터 레이어로 승격시켜, transform 변경이 GPU에서 직접 처리됨.

## 원인 4: 60Hz 전체화면 진입 시 Chromium vsync 재초기화 버그

듀얼 모니터(144Hz + 60Hz) 환경에서 `setFullScreen(true)` 호출 시 Chromium이 vsync를 재초기화하는 과정에 버그가 있어, 60Hz 모니터 전체화면에서 드래그가 극단적으로 느려짐. 창 모드에서는 정상.

**수정**: `app.commandLine.appendSwitch("disable-gpu-vsync")`로 GPU vsync 타이밍 강제 해제. 화면 티어링이 생길 수 있으나 실사용에서 티어링 없이 드래그 반응성 정상 확인됨.

**시도했다 실패한 방법**:
- `enter-full-screen` 이벤트 후 `win.webContents.invalidate()` 강제 리페인트 → vsync 없는 상태에서 리페인트가 추가로 끼어들어 오히려 더 이상해짐. `disable-gpu-vsync` 단독이 더 나음.
- borderless maximized (`win.maximize()`) → 드래그는 해결되나 독점 전체화면이 아니라 사용자 요구 미충족.

## 최종 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/core/PluginCard.jsx` | `React.memo` 적용, controlled → uncontrolled 전환, syncKey 패턴, NW/NE 보정 DOM 직접 읽기 |
| `src/core/Dashboard.jsx` | `useCallback` + 함수형 `setInstances`로 콜백 4개 안정화 |
