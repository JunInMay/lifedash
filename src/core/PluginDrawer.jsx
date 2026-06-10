import { getAllPlugins } from "./PluginRegistry";

// 플러그인 추가 패널. 등록된 모든 플러그인을 보여주고 클릭하면 칠판에 추가한다.
function PluginDrawer({ open, onAdd, onClose }) {
  if (!open) return null;

  return (
    <div className="drawer">
      <div className="drawer-header">
        <span>플러그인 추가</span>
        <button className="plugin-close" onClick={onClose}>✕</button>
      </div>
      <div className="drawer-list">
        {getAllPlugins().map((Plugin) => (
          <button
            key={Plugin.manifest.id}
            className="drawer-item"
            onClick={() => onAdd(Plugin.manifest.id)}
          >
            <span className="drawer-item-icon">{Plugin.manifest.icon}</span>
            <span className="drawer-item-text">
              <strong>{Plugin.manifest.name}</strong>
              <small>{Plugin.manifest.description}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default PluginDrawer;
