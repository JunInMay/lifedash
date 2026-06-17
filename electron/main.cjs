// lifedash-fable Electron 메인 프로세스.
// Tauri에서 마이그레이션 (tasks/MIGRATION.MD 참조) — 핵심 동기는 <webview> 태그가
// DOM에 합성되어 z-index/클리핑이 일반 카드처럼 동작한다는 것 (PoC 검증됨).
const { app, BrowserWindow, ipcMain, dialog, shell, net, protocol, Menu, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { execSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const log = require("electron-log/main");

// 파일 로그 설정: %APPDATA%/lifedash-fable/logs/main.log (최대 5MB × 5개 로테이션)
log.initialize();
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
log.transports.console.level = false; // 메인 프로세스 콘솔은 electron-log가 중복 안 씀
log.info("app start", { version: process.env.npm_package_version ?? "?" });

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const SMOKE = process.env.LIFEDASH_SMOKE === "1"; // CI/에이전트 검증용: 창 숨기고 자가진단 후 종료
const NOTIFICATIONS_ENABLED = false;

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
    icon: path.join(__dirname, "..", "build", "icon.png"),
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

function blockNotifications(targetSession) {
  targetSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "notifications") {
      callback(NOTIFICATIONS_ENABLED);
      return;
    }
    callback(false);
  });

  targetSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === "notifications") return NOTIFICATIONS_ENABLED;
    return false;
  });
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

// 렌더러 → 파일 로그 (레벨별 라우팅)
ipcMain.handle("log:write", (_e, entry) => {
  const { level, message, data } = entry ?? {};
  const fn = log[level] ?? log.info;
  data ? fn(message, data) : fn(message);
});

// engexpr data.js에 AI 생성 표현 추가 (개발 단계 전용)
ipcMain.handle("engexpr:append-data", (_e, newItems) => {
  const dataPath = path.join(__dirname, "..", "src", "plugins", "engexpr", "data.js");
  log.info("[engexpr] append-data 시작", { count: newItems.length });
  if (!fs.existsSync(dataPath)) throw new Error("data.js를 찾을 수 없습니다");
  const src = fs.readFileSync(dataPath, "utf-8");
  const insertPoint = src.lastIndexOf("];\n\nexport const TYPE_COLORS");
  if (insertPoint === -1) throw new Error("data.js 삽입 위치를 찾을 수 없습니다");
  const today = new Date().toISOString().slice(0, 10);
  const block = newItems.map((item) => [
    "  {",
    `    id: "${item.id}",`,
    `    type: "${item.type}",`,
    `    expression: "${item.expression.replace(/"/g, '\\"')}",`,
    `    usage: "${item.usage.replace(/"/g, '\\"')}",`,
    `    example: "${item.example.replace(/"/g, '\\"')}",`,
    "  },",
  ].join("\n")).join("\n");
  const header = `\n  // ── AI Generated (${today}) ────────────────────────────────────────\n`;
  const updated = src.slice(0, insertPoint) + header + block + "\n" + src.slice(insertPoint);
  fs.writeFileSync(dataPath, updated, "utf-8");
  log.info("[engexpr] data.js 파일 쓰기 완료");

  const projectRoot = path.join(__dirname, "..");
  try {
    execSync(`git add "${dataPath}"`, { cwd: projectRoot });
    execSync(`git commit -m "engexpr: AI 생성 표현 ${newItems.length}개 추가 (${today})"`, { cwd: projectRoot });
    execSync("git push", { cwd: projectRoot });
    log.info("[engexpr] git commit+push 완료", { count: newItems.length, date: today });
  } catch (gitErr) {
    log.error("[engexpr] git 오류", { message: gitErr.message });
    throw new Error(`data.js 저장은 됐지만 git 오류: ${gitErr.message}`);
  }

  return newItems.length;
});

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

  win.webContents.on("console-message", (e) => {
    console.log(`[renderer] ${e.message}`);
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => fail(`페이지 로드 실패 ${code} ${desc}`));

  win.webContents.on("did-finish-load", async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const out = {
          bridge: !!window.lifedash,
          board: !!document.querySelector(".board"),
          ua: navigator.userAgent,
        };
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

// OS 기본 메뉴바(File/Edit/...) 제거 — 추후 앱 내 설정 섹션으로 대체 예정.
// 주의: 메뉴의 기본 단축키(Ctrl+R 새로고침, F12 devtools)도 함께 사라진다.
// dev에서는 electron:dev가 detached devtools를 자동으로 열어주므로 지장 없음.
Menu.setApplicationMenu(null);

// User-Agent에서 앱/Electron 토큰 제거.
// teams.microsoft.com 등이 UA 스니핑으로 "미식별 브라우저 → 클래식(퇴역) Teams"로
// 보내는 문제 방지 — 순수 Chrome UA로 보이게 한다 (webview 세션에도 적용됨).
app.userAgentFallback = app.userAgentFallback
  .replace(new RegExp(`\\s${app.getName()}/\\S+`), "")
  .replace(/\sElectron\/\S+/, "");

app.whenReady().then(() => {
  blockNotifications(session.defaultSession);
  ["persist:youtube", "persist:teams", "persist:browser", "persist:webview"].forEach((partition) => {
    blockNotifications(session.fromPartition(partition));
  });

  app.on("web-contents-created", (_event, contents) => {
    blockNotifications(contents.session);
  });

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
