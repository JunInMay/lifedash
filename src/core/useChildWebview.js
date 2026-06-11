import { useEffect, useRef, useState } from "react";

// Tauri child webview를 카드 본문 위에 띄우고, hostRef DOM의 rect를 rAF로 추적해
// 웹뷰 위치/크기를 동기화하는 공용 훅. (youtube, teams 등 웹뷰 임베드 플러그인용)
// - hostRef를 .webview-host(frame 안쪽)에 달면 카드 모서리에 리사이즈 핸들 공간이 남는다.
// - 브라우저(npm run dev)에서는 status="browser"만 반환하고 아무것도 하지 않는다.

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

export function useChildWebview(instanceId, url, labelPrefix) {
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
        const label = `${labelPrefix}-${instanceId.slice(0, 8)}-${Date.now().toString(36)}`;

        webview = new Webview(getCurrentWindow(), label, {
          url,
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
  }, [instanceId, url, labelPrefix]);

  return { hostRef, status, errorMsg };
}
