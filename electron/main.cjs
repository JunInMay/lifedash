// lifedash-fable Electron 메인 프로세스.
// Tauri에서 마이그레이션 (MIGRATION.MD 참조) — 핵심 동기는 <webview> 태그가
// DOM에 합성되어 z-index/클리핑이 일반 카드처럼 동작한다는 것 (PoC 검증됨).
const { app, BrowserWindow, ipcMain, dialog, shell, net, protocol } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const SMOKE = process.env.LIFEDASH_SMOKE === "1"; // CI/에이전트 검증용: 창 숨기고 자가진단 후 종료

// 로컬 동영상 재생용 커스텀 프로토콜 (videoplayer 플러그인).
// http(s) 페이지에서 file://를 직접 못 읽으므로 media://v/?p=<encoded path>로 우회.
protocol.registerSchemesAsPrivileged([
  { scheme: "media", privileges: { stream: true, supportFetchAPI: true, bypassCSP: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#15171c",
    show: !SMOKE,
    title: "lifedash-fable",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true, // 핵심: DOM 합성 webview (Tauri child webview 문제의 해법)
    },
  });

  // 메인 페이지의 window.open은 외부 브라우저로 (webview 내부 팝업은 allowpopups로 허용)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
    if (!SMOKE) win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  if (SMOKE) runSmokeTest(win);
  return win;
}

// ---- IPC 핸들러 ----

// CORS 우회 fetch. Electron의 net.fetch는 Chromium 네트워크 스택을 쓰므로
// OS 인증서 저장소를 신뢰한다 → 사내망 SSL 인터셉션 환경에서도 동작 (Node fetch는 실패).
ipcMain.handle("net:fetch", async (_e, url, options = {}) => {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(`차단된 프로토콜: ${u.protocol}`);
  }
  const res = await net.fetch(url, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body,
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
});

ipcMain.handle("shell:openExternal", (_e, url) => {
  if (!/^https?:\/\//i.test(url)) throw new Error("http(s) URL만 열 수 있습니다");
  return shell.openExternal(url);
});

ipcMain.handle("dialog:pickVideos", async (_e, extensions) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "동영상", extensions }],
  });
  return canceled ? null : filePaths;
});

ipcMain.handle("fs:exists", (_e, p) => fs.existsSync(p));

ipcMain.handle("window:toggleFullscreen", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return false;
  const next = !win.isFullScreen();
  win.setFullScreen(next);
  return next;
});

// ---- 검증용 스모크 테스트 (LIFEDASH_SMOKE=1) ----
function runSmokeTest(win) {
  const fail = (msg) => {
    console.error(`[SMOKE] FAIL: ${msg}`);
    app.exit(1);
  };
  setTimeout(() => fail("타임아웃(30s)"), 30_000);

  win.webContents.on("console-message", (_e, _level, message) => {
    console.log(`[renderer] ${message}`);
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => fail(`페이지 로드 실패 ${code} ${desc}`));

  win.webContents.on("did-finish-load", async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const out = { bridge: !!window.lifedash, board: !!document.querySelector(".board") };
        if (window.lifedash) {
          const res = await window.lifedash.netFetch(
            "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=1d", {});
          out.ipcFetch = res.ok && JSON.parse(res.body)?.chart?.result?.[0]?.meta?.symbol === "AAPL";
        }
        return out;
      })()`);
      console.log(`[SMOKE] result: ${JSON.stringify(result)}`);
      if (result.bridge && result.board && result.ipcFetch) {
        console.log("[SMOKE] PASS");
        app.exit(0);
      } else {
        fail("자가진단 불일치");
      }
    } catch (err) {
      fail(String(err?.message ?? err));
    }
  });
}

app.whenReady().then(() => {
  protocol.handle("media", (req) => {
    const p = new URL(req.url).searchParams.get("p");
    if (!p) return new Response("bad request", { status: 400 });
    return net.fetch(pathToFileURL(p).toString());
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
