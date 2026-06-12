import { useEffect, useRef, useState } from "react";
import PluginCard from "./PluginCard";
import PluginDrawer from "./PluginDrawer";
import { getPlugin } from "./PluginRegistry";
import { loadLayout, saveLayout, clearPluginStorage } from "./storage";

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

// 첫 실행 시 기본 배치
const defaultInstances = [
  { instanceId: "default-clock", pluginId: "clock", x: 24, y: 24, w: 300, h: 170 },
  { instanceId: "default-timer", pluginId: "timer", x: 348, y: 24, w: 280, h: 180 },
];

function Dashboard() {
  const [instances, setInstances] = useState(() => loadLayout() ?? defaultInstances);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement
  );
  const boardRef = useRef(null);

  // 윈도우/브라우저 전체화면 상태 동기화 (F11 등 OS 단축키로 바뀌는 경우 포함)
  useEffect(() => {
    if (isTauri()) {
      let unlisten;
      (async () => {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        setIsFullscreen(await win.isFullscreen());
        unlisten = await win.onResized(async () => {
          setIsFullscreen(await win.isFullscreen());
        });
      })();
      return () => unlisten?.();
    }
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    if (isTauri()) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const next = !(await win.isFullscreen());
      await win.setFullscreen(next);
      setIsFullscreen(next);
      return;
    }
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const update = (next) => {
    setInstances(next);
    saveLayout(next);
  };

  const handleMove = (instanceId, x, y) => {
    update(instances.map((it) => (it.instanceId === instanceId ? { ...it, x, y } : it)));
  };

  const handleResize = (instanceId, w, h) => {
    update(instances.map((it) => (it.instanceId === instanceId ? { ...it, w, h } : it)));
  };

  const handleAdd = (pluginId) => {
    const Plugin = getPlugin(pluginId);
    if (!Plugin) return;
    const size = Plugin.manifest.defaultSize ?? { w: 280, h: 200 };
    // 같은 자리에 겹쳐 쌓이지 않게 개수만큼 계단식 배치
    const offset = 24 + (instances.length % 8) * 32;
    update([
      ...instances,
      {
        instanceId: crypto.randomUUID(),
        pluginId,
        x: offset,
        y: offset,
        w: size.w,
        h: size.h,
      },
    ]);
  };

  const handleRemove = (instanceId) => {
    clearPluginStorage(instanceId);
    update(instances.filter((it) => it.instanceId !== instanceId));
  };

  // 헤더 더블클릭: 다른 카드를 침범하지 않는 선에서 상하좌우로 그리디 확장.
  // 이미 최대화된 상태(_prev 보유)면 원래 크기/위치로 복원(토글).
  const handleMaximizeToggle = (instanceId) => {
    const target = instances.find((it) => it.instanceId === instanceId);
    if (!target) return;

    if (target._prev) {
      const { x, y, w, h } = target._prev;
      update(
        instances.map((it) =>
          it.instanceId === instanceId ? { ...it, x, y, w, h, _prev: undefined } : it
        )
      );
      return;
    }

    const GAP = 4;
    const boardW = boardRef.current?.clientWidth ?? window.innerWidth;
    const boardH = boardRef.current?.clientHeight ?? window.innerHeight;
    const others = instances.filter((it) => it.instanceId !== instanceId);

    let left = GAP;
    let right = boardW - GAP;
    let top = GAP;
    let bottom = boardH - GAP;

    for (const o of others) {
      const vOverlap = o.y < target.y + target.h && o.y + o.h > target.y;
      if (vOverlap) {
        if (o.x + o.w <= target.x) left = Math.max(left, o.x + o.w + GAP);
        if (o.x >= target.x + target.w) right = Math.min(right, o.x - GAP);
      }
      const hOverlap = o.x < target.x + target.w && o.x + o.w > target.x;
      if (hOverlap) {
        if (o.y + o.h <= target.y) top = Math.max(top, o.y + o.h + GAP);
        if (o.y >= target.y + target.h) bottom = Math.min(bottom, o.y - GAP);
      }
    }

    update(
      instances.map((it) =>
        it.instanceId === instanceId
          ? {
              ...it,
              _prev: { x: it.x, y: it.y, w: it.w, h: it.h },
              x: left,
              y: top,
              w: right - left,
              h: bottom - top,
            }
          : it
      )
    );
  };

  // 정렬: 현재 배치의 읽기 순서(위→아래, 왼→오른쪽)대로 크기를 유지한 채,
  // 각 카드를 "가장 위쪽, 그중 가장 왼쪽"의 들어갈 수 있는 빈자리에 채워 넣는다
  // (bottom-left 그리디 패킹). 행 단위 선반 방식과 달리 키 큰 카드 옆의
  // 빈 공간에도 다음 카드가 들어가므로 세로 낭비가 없다. 깨진 레이아웃 복구용.
  const arrange = () => {
    const GAP = 4;
    const boardW = boardRef.current?.clientWidth ?? window.innerWidth;
    const ordered = [...instances].sort((a, b) => a.y - b.y || a.x - b.x);

    const placed = [];
    const coords = new Map();

    const collides = (x, y, w, h) =>
      placed.some(
        (p) =>
          !(
            x >= p.x + p.w + GAP ||
            p.x >= x + w + GAP ||
            y >= p.y + p.h + GAP ||
            p.y >= y + h + GAP
          )
      );

    for (const it of ordered) {
      // 후보 위치: 좌상단 + 이미 놓인 카드들의 바로 아래/바로 오른쪽
      const candidates = [{ x: GAP, y: GAP }];
      for (const p of placed) {
        candidates.push({ x: p.x, y: p.y + p.h + GAP });
        candidates.push({ x: p.x + p.w + GAP, y: p.y });
        candidates.push({ x: GAP, y: p.y + p.h + GAP });
      }
      candidates.sort((a, b) => a.y - b.y || a.x - b.x);

      let pos = candidates.find(
        (c) => c.x + it.w <= boardW - GAP && !collides(c.x, c.y, it.w, it.h)
      );
      if (!pos) {
        // 보드 폭보다 넓은 카드 등: 모든 카드 아래에 단독 배치
        const bottom = placed.reduce((m, p) => Math.max(m, p.y + p.h), 0);
        pos = { x: GAP, y: bottom + GAP };
      }
      placed.push({ x: pos.x, y: pos.y, w: it.w, h: it.h });
      coords.set(it.instanceId, { x: pos.x, y: pos.y });
    }

    update(instances.map((it) => ({ ...it, ...coords.get(it.instanceId) })));
  };

  return (
    <div className="dashboard">
      <header className="topbar">
        <span className="topbar-logo">lifedash</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="topbar-add" title="카드를 좌상단부터 재배치" onClick={arrange}>
            ⊞ 정렬
          </button>
          <button
            className="topbar-add"
            title={isFullscreen ? "전체화면 종료" : "전체화면"}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? "⛶ 창모드" : "⛶ 전체화면"}
          </button>
          <button className="topbar-add" onClick={() => setDrawerOpen((o) => !o)}>
            + 플러그인
          </button>
        </div>
      </header>

      <div className="board" ref={boardRef}>
        {instances.map((instance) => (
          <PluginCard
            key={instance.instanceId}
            instance={instance}
            onMove={handleMove}
            onResize={handleResize}
            onRemove={handleRemove}
            onMaximizeToggle={handleMaximizeToggle}
          />
        ))}
        {instances.length === 0 && (
          <div className="board-empty">
            우상단 <strong>+ 플러그인</strong> 버튼으로 위젯을 추가하세요
          </div>
        )}
      </div>

      <PluginDrawer open={drawerOpen} onAdd={handleAdd} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

export default Dashboard;
