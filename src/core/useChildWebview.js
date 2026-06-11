import { useEffect, useRef, useState } from "react";

// Tauri child webview를 카드 본문 위에 띄우고, hostRef DOM의 rect를 rAF로 추적해
// 웹뷰 위치/크기를 동기화하는 공용 훅. (youtube, teams 등 웹뷰 임베드 플러그인용)
//
// 리사이즈 핸들 처리 (동적 수축):
// 네이티브 웹뷰는 HTML 위의 별도 OS 표면이라, 웹뷰가 덮은 픽셀의 마우스 이벤트는
// HTML 핸들에 절대 도달하지 않는다. 그래서 평소엔 웹뷰가 카드를 꽉 채우되,
// 전역 커서 좌표(cursorPosition — 커서가 웹뷰 위에 있어도 동작하는 폴링 API)를
// 주기적으로 확인해 커서가 카드 가장자리 띠에 들어온 순간만 웹뷰를 좌/우/하단으로
// 수축시켜 핸들을 노출한다. 상단 모서리(ne/nw) 핸들은 HTML인 헤더 위라 수축 불필요.
// 커서 API를 못 쓰는 환경이면 고정 inset으로 폴백한다.

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

const SHRINK_INSET = 18; // 수축 시 노출되는 가장자리 폭 (핸들 20px 기준)
const FALLBACK_INSET = 14; // 커서 폴링 불가 시 상시 적용할 inset
const EDGE_BAND = 22; // 카드 테두리 안쪽 몇 px까지를 "가장자리"로 볼지
const EDGE_OUT = 10; // 카드 테두리 바깥 여유
const POLL_MS = 90; // 커서 폴링 주기
const HOLD_MS = 350; // 가장자리를 벗어난 뒤 복원까지 유예 (깜빡임 방지)

export function useChildWebview(instanceId, url, labelPrefix) {
  const hostRef = useRef(null);
  const [status, setStatus] = useState(isTauri() ? "loading" : "browser");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isTauri()) return;

    let alive = true;
    let webview = null;
    let raf = 0;
    let pollTimer = 0;
    let inset = 0;
    let lastNearTs = 0;

    (async () => {
      try {
        const [{ getCurrentWindow }, { Webview }, { LogicalPosition, LogicalSize }] =
          await Promise.all([
            import("@tauri-apps/api/window"),
            import("@tauri-apps/api/webview"),
            import("@tauri-apps/api/dpi"),
          ]);
        const appWindow = getCurrentWindow();

        const rect = hostRef.current.getBoundingClientRect();
        // StrictMode 재마운트 시 라벨 충돌이 없도록 마운트마다 고유 라벨 사용
        const label = `${labelPrefix}-${instanceId.slice(0, 8)}-${Date.now().toString(36)}`;

        webview = new Webview(appWindow, label, {
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

        // 커서가 카드 가장자리 근처인지 폴링 → inset 결정
        const pollCursor = async () => {
          try {
            const [cursor, origin, scale] = await Promise.all([
              appWindow.cursorPosition(),
              appWindow.innerPosition(),
              appWindow.scaleFactor(),
            ]);
            const cx = (cursor.x - origin.x) / scale; // 클라이언트(CSS px) 좌표
            const cy = (cursor.y - origin.y) / scale;
            const card = hostRef.current?.closest(".plugin-card");
            if (!card) return;
            const r = card.getBoundingClientRect();
            const inOuter =
              cx >= r.left - EDGE_OUT && cx <= r.right + EDGE_OUT &&
              cy >= r.top - EDGE_OUT && cy <= r.bottom + EDGE_OUT;
            const inInner =
              cx >= r.left + EDGE_BAND && cx <= r.right - EDGE_BAND &&
              cy >= r.top + EDGE_BAND && cy <= r.bottom - EDGE_BAND;
            const near = inOuter && !inInner;
            const now = Date.now();
            if (near) lastNearTs = now;
            inset = near || now - lastNearTs < HOLD_MS ? SHRINK_INSET : 0;
          } catch {
            // cursorPosition 미지원/권한 없음 → 상시 고정 inset으로 폴백
            inset = FALLBACK_INSET;
            clearInterval(pollTimer);
          }
        };
        pollTimer = setInterval(pollCursor, POLL_MS);

        // 카드 드래그/리사이즈/수축을 따라가도록 매 프레임 위치 동기화
        const last = { x: NaN, y: NaN, w: NaN, h: NaN };
        const track = () => {
          if (!alive) return;
          const el = hostRef.current;
          if (el) {
            const r = el.getBoundingClientRect();
            // 좌/우/하단만 inset (상단 핸들은 헤더 위라 노출 불필요)
            const x = r.left + inset;
            const y = r.top;
            const w = Math.max(50, r.width - inset * 2);
            const h = Math.max(50, r.height - inset);
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
      clearInterval(pollTimer);
      webview?.close().catch(() => {});
    };
  }, [instanceId, url, labelPrefix]);

  return { hostRef, status, errorMsg };
}
