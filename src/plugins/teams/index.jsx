import { useEffect, useRef, useState } from "react";

// Tauri child webview로 진짜 teams.microsoft.com을 카드 본문 위에 띄운다.
// - 네이티브 웹뷰는 HTML 위에 떠 있으므로, 카드 위치를 rAF로 추적해 따라붙인다.
// - 브라우저(npm run dev)에서는 child webview가 없으므로 안내만 표시한다.
const TEAMS_URL = "https://teams.microsoft.com";

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

function TeamsPlugin({ instanceId }) {
  const hostRef = useRef(null);
  const [status, setStatus] = useState(isTauri() ? "loading" : "browser");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isTauri()) return;

    let alive = true;
    let webview = null;
    let raf = 0;

    (async () => {
      try {
        const [{ getCurrentWindow }, { Webview }, { LogicalPosition, LogicalSize }] =
          await Promise.all([
            import("@tauri-apps/api/window"),
            import("@tauri-apps/api/webview"),
            import("@tauri-apps/api/dpi"),
          ]);

        const rect = hostRef.current.getBoundingClientRect();
        // StrictMode 재마운트 시 라벨 충돌이 없도록 마운트마다 고유 라벨 사용
        const label = `teams-${instanceId.slice(0, 8)}-${Date.now().toString(36)}`;

        webview = new Webview(getCurrentWindow(), label, {
          url: TEAMS_URL,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });

        await new Promise((resolve, reject) => {
          webview.once("tauri://created", resolve);
          webview.once("tauri://error", (e) =>
            reject(new Error(typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload)))
          );
        });

        if (!alive) {
          webview.close().catch(() => {});
          return;
        }
        setStatus("ready");

        // 카드 드래그/리사이즈를 따라가도록 매 프레임 위치 동기화
        const last = { x: NaN, y: NaN, w: NaN, h: NaN };
        const track = () => {
          if (!alive) return;
          const el = hostRef.current;
          if (el) {
            const r = el.getBoundingClientRect();
            if (r.left !== last.x || r.top !== last.y) {
              last.x = r.left;
              last.y = r.top;
              webview.setPosition(new LogicalPosition(r.left, r.top)).catch(() => {});
            }
            if (r.width !== last.w || r.height !== last.h) {
              last.w = r.width;
              last.h = r.height;
              webview.setSize(new LogicalSize(r.width, r.height)).catch(() => {});
            }
          }
          raf = requestAnimationFrame(track);
        };
        raf = requestAnimationFrame(track);
      } catch (err) {
        if (!alive) return;
        setStatus("error");
        setErrorMsg(String(err?.message ?? err));
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      webview?.close().catch(() => {});
    };
  }, [instanceId]);

  return (
    <div
      ref={hostRef}
      className="widget-pad"
      style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8 }}
    >
      {status === "loading" && <div style={{ color: "#8b93a3" }}>팀즈 로딩 중...</div>}
      {status === "ready" && <div style={{ color: "#5b6270" }}>팀즈가 이 위에 표시됩니다</div>}
      {status === "error" && (
        <div style={{ color: "#f87171", fontSize: 12, wordBreak: "break-all" }}>
          웹뷰 생성 실패: {errorMsg}
        </div>
      )}
      {status === "browser" && (
        <>
          <div style={{ fontSize: 28 }}>👥</div>
          <div style={{ color: "#8b93a3", fontSize: 13, lineHeight: 1.6 }}>
            팀즈 플러그인은 데스크탑 앱에서 동작합니다.
            <br />
            <code>npm run tauri dev</code>로 실행해 주세요.
          </div>
        </>
      )}
    </div>
  );
}

export default TeamsPlugin;
