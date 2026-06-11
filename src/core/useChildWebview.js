import { useEffect, useRef, useState } from "react";

// Tauri child webview를 카드 본문 위에 띄우고, hostRef DOM의 rect를 rAF로 추적해
// 웹뷰 위치/크기를 동기화하는 공용 훅. (youtube, teams 등 웹뷰 임베드 플러그인용)
//
// 웹뷰는 카드 본문을 사실상 꽉 채운다. 단, 카드 border-radius(10px)의 곡선이
// 직각 모서리에서 최대 ~3px 벗어나므로, 좌/우/하단을 3px만 안쪽으로 넣어
// 웹뷰의 사각 모서리가 카드의 둥근 윤곽선을 뚫고 나오지 않게 한다.
// (네이티브 웹뷰 자체를 둥글게 깎는 API는 Tauri에 없음)
//
// 알려진 제약: 네이티브 웹뷰가 덮은 픽셀의 마우스 이벤트는 HTML에 도달하지 않으므로
// 하단(se/sw) 리사이즈 핸들은 웹뷰 위에서 동작하지 않는다. 상단(ne/nw) 핸들은
// HTML인 헤더 위라 정상 동작 — 웹뷰 플러그인 리사이즈는 상단 모서리를 쓸 것.

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

const CORNER_INSET = 3; // 카드 라운딩 곡선과의 간섭 회피 폭

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
          x: rect.left + CORNER_INSET,
          y: rect.top,
          width: rect.width - CORNER_INSET * 2,
          height: rect.height - CORNER_INSET,
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
            const x = r.left + CORNER_INSET;
            const y = r.top;
            const w = Math.max(50, r.width - CORNER_INSET * 2);
            const h = Math.max(50, r.height - CORNER_INSET);
            if (x !== last.x || y !== last.y) {
              last.x = x;
              last.y = y;
              webview.setPosition(new LogicalPosition(x, y)).catch(() => {});
            }
            if (w !== last.w || h !== last.h) {
              last.w = w;
              last.h = h;
              webview.setSize(new LogicalSize(w, h)).catch(() => {});
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
