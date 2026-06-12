// 렌더러에 노출되는 데스크탑 브리지. 렌더러 코드는 window.lifedash로 접근한다.
// (Tauri 시절의 @tauri-apps/* 호출을 전부 이 브리지로 치환 — src/core/desktop.js 참조)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lifedash", {
  isElectron: true,
  /** CORS 없는 fetch (메인 프로세스 경유). {ok, status, body(text)} 반환 */
  netFetch: (url, options) => ipcRenderer.invoke("net:fetch", url, options),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  pickVideos: (extensions) => ipcRenderer.invoke("dialog:pickVideos", extensions),
  fileExists: (p) => ipcRenderer.invoke("fs:exists", p),
  toggleFullscreen: () => ipcRenderer.invoke("window:toggleFullscreen"),
  /** 로컬 동영상 파일 → <video src>용 URL */
  mediaSrc: (p) => `media://v/?p=${encodeURIComponent(p)}`,
});
