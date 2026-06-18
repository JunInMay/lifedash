import { memo, useMemo, useRef, useState } from "react";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { getPlugin } from "./PluginRegistry";
import { eventBus } from "./eventBus";
import { createPluginStorage } from "./storage";
import "react-resizable/css/styles.css";

function PluginCard({ instance, onMove, onResize, onRemove, onMaximizeToggle }) {
  const nodeRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const resizeStart = useRef(null);

  // 드래그가 마지막으로 멈춘 위치. 외부(정렬/최대화)에서 좌표가 바뀌면
  // syncKey를 올려 Draggable을 재초기화한다.
  const lastDragPos = useRef({ x: instance.x, y: instance.y });
  const [syncKey, setSyncKey] = useState(0);
  const prevInstancePos = useRef({ x: instance.x, y: instance.y });

  if (
    prevInstancePos.current.x !== instance.x ||
    prevInstancePos.current.y !== instance.y
  ) {
    prevInstancePos.current = { x: instance.x, y: instance.y };
    if (
      lastDragPos.current.x !== instance.x ||
      lastDragPos.current.y !== instance.y
    ) {
      lastDragPos.current = { x: instance.x, y: instance.y };
      setSyncKey((k) => k + 1);
    }
  }

  const Plugin = getPlugin(instance.pluginId);
  const storage = useMemo(
    () => createPluginStorage(instance.instanceId),
    [instance.instanceId]
  );

  if (!Plugin) return null;

  const minSize = Plugin.manifest.minSize ?? { w: 200, h: 150 };
  const hasSettings = !!Plugin.Settings;

  return (
    <Draggable
      key={syncKey}
      nodeRef={nodeRef}
      handle=".plugin-handle"
      defaultPosition={{ x: instance.x, y: instance.y }}
      bounds="parent"
      onStop={(_e, data) => {
        lastDragPos.current = { x: data.x, y: data.y };
        onMove(instance.instanceId, data.x, data.y);
      }}
    >
      <div ref={nodeRef} className="plugin-card-wrap">
        <ResizableBox
          width={instance.w}
          height={instance.h}
          minConstraints={[minSize.w, minSize.h]}
          resizeHandles={["se", "sw", "ne", "nw"]}
          onResizeStart={(_e, { size, handle }) => {
            // 현재 드래그 위치는 nodeRef transform에서 직접 읽는다
            const style = nodeRef.current?.style.transform ?? "";
            const match = style.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
            const curX = match ? parseFloat(match[1]) : instance.x;
            const curY = match ? parseFloat(match[2]) : instance.y;
            resizeStart.current = { x: curX, y: curY, w: size.width, h: size.height, handle };
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
            lastDragPos.current = { x, y };
            if (x !== instance.x || y !== instance.y) onMove(instance.instanceId, x, y);
            onResize(instance.instanceId, size.width, size.height);
          }}
          className="plugin-card"
        >
          <div className="plugin-handle" onDoubleClick={() => onMaximizeToggle(instance.instanceId)}>
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
    </Draggable>
  );
}

export default memo(PluginCard);
