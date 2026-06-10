import { useState } from "react";
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

  return (
    <div className="dashboard">
      <header className="topbar">
        <span className="topbar-logo">lifedash</span>
        <button className="topbar-add" onClick={() => setDrawerOpen((o) => !o)}>
          + 플러그인
        </button>
      </header>

      <div className="board">
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
