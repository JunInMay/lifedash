import { useState } from "react";
import WebviewEmbed from "../../core/WebviewEmbed";
import "./browser.css";

const DEFAULT_URL = "https://www.google.com";

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

// 사용자가 입력한 임의 URL을 <webview>로 카드 안에 표시.
function BrowserPlugin({ storage }) {
  const [url, setUrl] = useState(() => storage.get("url", DEFAULT_URL));
  const [input, setInput] = useState(url);

  const go = () => {
    const next = normalizeUrl(input);
    if (!next) return;
    setInput(next);
    setUrl(next);
    storage.set("url", next);
  };

  return (
    <div className="browser-root">
      <div className="browser-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="URL 입력 (예: youtube.com)"
        />
        <button onClick={go}>이동</button>
      </div>
      <div className="browser-host">
        <WebviewEmbed url={url} partition="persist:browser" />
      </div>
    </div>
  );
}

export default BrowserPlugin;
