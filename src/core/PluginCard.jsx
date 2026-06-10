import { useMemo, useRef, useState } from "react";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { getPlugin } from "./PluginRegistry";
import { eventBus } from "./eventBus";
import { createPluginStorage } from "./storage";
import "react-resizable/css/styles.css";

function PluginCard({ instance, onMove, onResize, onRemove }) {
  const nodeRef = useRef(null);
  const [pos, setPos] = useState({ x: instance.x, y: instance.y });
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
          onResizeStop={(_e, { size }) =>
            onResize(instance.instanceId, size.width, size.height)
          }
          className="plugin-card"
        >
          <div className="plugin-handle">
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
