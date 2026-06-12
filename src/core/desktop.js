// 데스크탑(Electron) 브리지 헬퍼.
// - Electron: preload가 노출한 window.lifedash 사용
// - 브라우저 dev(vite): 각 호출처가 vite 프록시 등 웹 대체 경로로 폴백
// Tauri 시절의 isTauri()/@tauri-apps/* 호출을 전부 이 모듈로 일원화했다.

export const isDesktop = () =>
  typeof window !== "undefined" && !!window.lifedash;

/**
 * CORS 없는 fetch (Electron 메인 프로세스의 Chromium 네트워크 스택 경유 —
 * OS 인증서를 신뢰하므로 사내망 SSL 인터셉션에서도 동작).
 * fetch Response의 부분집합 {ok, status, json(), text()}를 반환한다.
 */
export async function desktopFetch(url, options) {
  const res = await window.lifedash.netFetch(url, options);
  return {
    ok: res.ok,
    status: res.status,
    json: async () => JSON.parse(res.body),
    text: async () => res.body,
  };
}

/** 기본 브라우저로 URL 열기. 브라우저 dev에서는 새 탭. */
export async function openExternal(url) {
  if (isDesktop()) {
    try {
      await window.lifedash.openExternal(url);
      return;
    } catch {
      // fall through
    }
  }
  window.open(url, "_blank");
}

/** 앱 창 전체화면 토글. 브라우저 dev에서는 document fullscreen. */
export async function toggleFullscreen() {
  if (isDesktop()) {
    await window.lifedash.toggleFullscreen();
    return;
  }
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
}
