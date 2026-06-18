import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ResizableBox } from "react-resizable";
import { getPlugin } from "./PluginRegistry";
import { eventBus } from "./eventBus";
import { createPluginStorage } from "./storage";
import "react-resizable/css/styles.css";

function useDrag(nodeRef, { x, y, bounds, onStop }) {
  const posRef = useRef({ x, y });

  // 외부(정렬/최대화)에서 좌표가 바뀌면 DOM에 직접 반영
  useEffect(() => {
    posRef.current = { x, y };
    if (nodeRef.current) {
      nodeRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, [x, y, nodeRef]);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = posRef.current.x;
    const startY = posRef.current.y;

    const onMouseMove = (e) => {
      const parent = nodeRef.current?.parentElement;
      const maxX = bounds && parent ? parent.clientWidth - nodeRef.current.offsetWidth : Infinity;
      const maxY = bounds && parent ? parent.clientHeight - nodeRef.current.offsetHeight : Infinity;

      const x = Math.max(0, Math.min(maxX, startX + e.clientX - startMouseX));
      const y = Math.max(0, Math.min(maxY, startY + e.clientY - startMouseY));

      posRef.current = { x, y };
      nodeRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      onStop(posRef.current.x, posRef.current.y);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return { onMouseDown };
}

function PluginCard({ instance, onMove, onResize, onRemove, onMaximizeToggle }) {
  const nodeRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const resizeStart = useRef(null);

  const { onMouseDown: handleDragMouseDown } = useDrag(nodeRef, {
    x: instance.x,
    y: instance.y,
    bounds: true,
    onStop: (x, y) => onMove(instance.instanceId, x, y),
  });

  const Plugin = getPlugin(instance.pluginId);
  const storage = useMemo(
    () => createPluginStorage(instance.instanceId),
    [instance.instanceId]
  );

  if (!Plugin) return null;

  const minSize = Plugin.manifest.minSize ?? { w: 200, h: 150 };
  const hasSettings = !!Plugin.Settings;

  const getCurrentPos = () => {
    const style = nodeRef.current?.style.transform ?? "";
    const match = style.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
    return {
      x: match ? parseFloat(match[1]) : instance.x,
      y: match ? parseFloat(match[2]) : instance.y,
    };
  };

  return (
    <div
      ref={nodeRef}
      className="plugin-card-wrap"
      style={{ transform: `translate(${instance.x}px, ${instance.y}px)` }}
    >
      <ResizableBox
        width={instance.w}
        height={instance.h}
        minConstraints={[minSize.w, minSize.h]}
        resizeHandles={["se", "sw", "ne", "nw"]}
        onResizeStart={(_e, { size, handle }) => {
          const pos = getCurrentPos();
          resizeStart.current = { x: pos.x, y: pos.y, w: size.width, h: size.height, handle };
        }}
        onResize={(_e, { size, handle }) => {
          const start = resizeStart.current;
          if (!start || !nodeRef.current) return;
          let x = start.x;
          let y = start.y;
          if (handle.includes("w")) x = start.x - (size.width - start.w);
          if (handle.includes("n")) y = start.y - (size.height - start.h);
          nodeRef.current.style.transform = `translate(${x}px, ${y}px)`;
        }}
        onResizeStop={(_e, { size, handle }) => {
          const start = resizeStart.current;
          resizeStart.current = null;
          if (!start) {
            onResize(instance.instanceId, size.width, size.height);
            return;
          }
          let x = start.x;
          let y = start.y;
          if (handle.includes("w")) x = start.x - (size.width - start.w);
          if (handle.includes("n")) y = start.y - (size.height - start.h);
          if (x !== instance.x || y !== instance.y) onMove(instance.instanceId, x, y);
          onResize(instance.instanceId, size.width, size.height);
        }}
        className="plugin-card"
      >
        <div
          className="plugin-handle"
          onMouseDown={handleDragMouseDown}
          onDoubleClick={() => onMaximizeToggle(instance.instanceId)}
        >
          <span className="plugin-title">
            {Plugin.manifest.icon} {Plugin.manifest.name}
          </span>
          <div className="plugin-header-actions">
            {hasSettings && (
              <button
                className="plugin-settings-toggle"
                title="플러그인 설정"
                onClick={() => setSettingsOpen((o) => !o)}
              >
                ⚙
              </button>
            )}
            <button
              className="plugin-close"
              title="플러그인 제거"
              onClick={() => onRemove(instance.instanceId)}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="plugin-body">
          <Plugin
            instanceId={instance.instanceId}
            storage={storage}
            bus={eventBus}
            width={instance.w}
            height={instance.h}
          />
          {hasSettings && settingsOpen && (
            <div
              className="plugin-settings-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSettingsOpen(false);
              }}
            >
              <div className="plugin-settings-panel">
                <div className="plugin-settings-panel-header">
                  <span>{Plugin.manifest.name} 설정</span>
                  <button className="plugin-close" onClick={() => setSettingsOpen(false)}>
                    ✕
                  </button>
                </div>
                <Plugin.Settings
                  instanceId={instance.instanceId}
                  storage={storage}
                  bus={eventBus}
                  close={() => setSettingsOpen(false)}
                />
              </div>
            </div>
          )}
        </div>
      </ResizableBox>
    </div>
  );
}

export default memo(PluginCard);
