import { useRef, useState } from "react";
import PluginCard from "./PluginCard";
import PluginDrawer from "./PluginDrawer";
import { getPlugin } from "./PluginRegistry";
import { loadLayout, saveLayout, clearPluginStorage } from "./storage";

// 첫 실행 시 기본 배치
const defaultInstances = [
  { instanceId: "default-clock", pluginId: "clock", x: 24, y: 24, w: 300, h: 170 },
  { instanceId: "default-timer", pluginId: "timer", x: 348, y: 24, w: 280, h: 180 },
];

function Dashboard() {
  const [instances, setInstances] = useState(() => loadLayout() ?? defaultInstances);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const boardRef = useRef(null);

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

  // 정렬: 현재 화면 배치 순서(위→아래, 왼→오른쪽)대로 크기를 유지한 채
  // 좌상단부터 선반(shelf) 방식으로 재배치한다. 깨진 레이아웃 복구용.
  const arrange = () => {
    const GAP = 16;
    const boardW = boardRef.current?.clientWidth ?? window.innerWidth;
    const ordered = [...instances].sort((a, b) => a.y - b.y || a.x - b.x);

    const coords = new Map();
    let x = GAP;
    let y = GAP;
    let rowH = 0;
    for (const it of ordered) {
      if (x > GAP && x + it.w > boardW - GAP) {
        x = GAP;
        y += rowH + GAP;
        rowH = 0;
      }
      coords.set(it.instanceId, { x, y });
      x += it.w + GAP;
      rowH = Math.max(rowH, it.h);
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
