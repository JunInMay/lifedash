import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

function normalize(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function LinksPlugin({ storage }) {
  const [links, setLinks] = useState(() => storage.get("links", []));
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const update = (next) => {
    setLinks(next);
    storage.set("links", next);
  };

  const add = () => {
    if (!name.trim() || !url.trim()) return;
    update([...links, { id: crypto.randomUUID(), name: name.trim(), url: normalize(url.trim()) }]);
    setName("");
    setUrl("");
  };

  const open = async (link) => {
    try {
      await openUrl(link.url); // Tauri 환경: OS 기본 브라우저
    } catch {
      window.open(link.url, "_blank"); // 순수 브라우저 환경 fallback
    }
  };

  return (
    <div className="widget-pad" style={{ gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="widget-input"
          style={{ flex: "0 0 80px" }}
          value={name}
          placeholder="이름"
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="widget-input"
          value={url}
          placeholder="URL"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="widget-btn" onClick={add}>+</button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, overflowY: "auto", flex: 1 }}>
        {links.map((link) => (
          <li
            key={link.id}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" }}
          >
            <button
              className="widget-btn"
              style={{ flex: 1, textAlign: "left", border: "none", background: "transparent" }}
              title={link.url}
              onClick={() => open(link)}
            >
              🔗 {link.name}
            </button>
            <button
              className="plugin-close"
              onClick={() => update(links.filter((l) => l.id !== link.id))}
            >
              ✕
            </button>
          </li>
        ))}
        {links.length === 0 && (
          <li style={{ color: "#5b6270", padding: "8px 2px" }}>등록된 링크가 없습니다</li>
        )}
      </ul>
    </div>
  );
}

export default LinksPlugin;
