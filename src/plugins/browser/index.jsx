import { useState } from "react";
import { useChildWebview } from "../../core/useChildWebview";
import "./browser.css";

const DEFAULT_URL = "https://www.google.com";

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

// 사용자가 입력한 임의 URL을 child webview로 카드 안에 표시 (youtube/teams와 동일 패턴).
// 주소창은 일반 HTML이라 항상 입력 가능, 그 아래 영역만 webview-host로 추적된다.
function BrowserPlugin({ instanceId, storage }) {
  const [url, setUrl] = useState(() => storage.get("url", DEFAULT_URL));
  const [input, setInput] = useState(url);
  const { hostRef, status, errorMsg } = useChildWebview(instanceId, url, "browser");

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
      <div ref={hostRef} className="browser-host">
        {status === "loading" && <div>로딩 중...</div>}
        {status === "error" && <div className="webview-error">웹뷰 생성 실패: {errorMsg}</div>}
        {status === "browser" && (
          <div>
            <div style={{ fontSize: 28 }}>🌐</div>
            웹뷰 플러그인은 데스크탑 앱에서 동작합니다.
            <br />
            <code>npm run tauri dev</code>로 실행해 주세요.
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowserPlugin;
