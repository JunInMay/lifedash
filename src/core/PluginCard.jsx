import { useEffect, useMemo, useRef, useState } from "react";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { getPlugin } from "./PluginRegistry";
import { eventBus } from "./eventBus";
import { createPluginStorage } from "./storage";
import "react-resizable/css/styles.css";

function PluginCard({ instance, onMove, onResize, onRemove, onMaximizeToggle }) {
  const nodeRef = useRef(null);
  const [pos, setPos] = useState({ x: instance.x, y: instance.y });
  const resizeStart = useRef(null);

  // 정렬 버튼 등 외부에서 좌표가 바뀌면 로컬 드래그 상태도 따라가게 동기화
  useEffect(() => {
    setPos({ x: instance.x, y: instance.y });
  }, [instance.x, instance.y]);

  const Plugin = getPlugin(instance.pluginId);
  const storage = useMemo(
    () => createPluginStorage(instance.instanceId),
    [instance.instanceId]
  );

  if (!Plugin) return null;

  const minSize = Plugin.manifest.minSize ?? { w: 200, h: 150 };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".plugin-handle"
      position={pos}
      bounds="parent"
      onDrag={(_e, data) => setPos({ x: data.x, y: data.y })}
      onStop={(_e, data) => {
        setPos({ x: data.x, y: data.y });
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
            resizeStart.current = { x: pos.x, y: pos.y, w: size.width, h: size.height, handle };
          }}
          onResize={(_e, { size, handle }) => {
            const start = resizeStart.current;
            if (!start) return;
            let x = start.x;
            let y = start.y;
            if (handle.includes("w")) x = start.x - (size.width - start.w);
            if (handle.includes("n")) y = start.y - (size.height - start.h);
            setPos({ x, y });
          }}
          onResizeStop={(_e, { size, handle }) => {
            const start = resizeStart.current;
            let x = pos.x;
            let y = pos.y;
            if (start) {
              x = start.x;
              y = start.y;
              if (handle.includes("w")) x = start.x - (size.width - start.w);
              if (handle.includes("n")) y = start.y - (size.height - start.h);
            }
            resizeStart.current = null;
            if (x !== instance.x || y !== instance.y) onMove(instance.instanceId, x, y);
            onResize(instance.instanceId, size.width, size.height);
          }}
          className="plugin-card"
        >
          <div className="plugin-handle" onDoubleClick={() => onMaximizeToggle(instance.instanceId)}>
            <span className="plugin-title">
              {Plugin.manifest.icon} {Plugin.manifest.name}
            </span>
            <button
              className="plugin-close"
              title="플러그인 제거"
              onClick={() => onRemove(instance.instanceId)}
            >
              ✕
            </button>
          </div>
          <div className="plugin-body">
            <Plugin
              instanceId={instance.instanceId}
              storage={storage}
              bus={eventBus}
              width={instance.w}
              height={instance.h}
            />
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
}

export default PluginCard;
