// 앱 전체 로거. 브라우저 콘솔 + Electron 파일 로그 동시 출력.
// 사용: import { log } from "./logger"; → log.info("msg", { key: val })
//       import { logAction } from "./logger"; → logAction("plugin:add", { pluginId })

const LEVELS = ["debug", "info", "warn", "error"];

const LEVEL_STYLE = {
  debug: "color:#888",
  info:  "color:#4af",
  warn:  "color:#fa0",
  error: "color:#f55",
};

function send(level, message, data) {
  const ts = new Date().toISOString();
  const entry = { ts, level, message, ...(data && { data }) };

  // 콘솔 출력
  const style = LEVEL_STYLE[level] ?? "";
  const args = data
    ? [`%c[${level.toUpperCase()}] ${message}`, style, data]
    : [`%c[${level.toUpperCase()}] ${message}`, style];
  console[level === "debug" ? "log" : level](...args);

  // Electron 파일 로그 (IPC → main → electron-log)
  if (window.lifedash?.logWrite) {
    window.lifedash.logWrite(entry).catch(() => {});
  }
}

export const log = Object.fromEntries(
  LEVELS.map((lvl) => [lvl, (message, data) => send(lvl, message, data)])
);

// 사용자 액션 전용 (info 레벨, [ACTION] 접두어로 파일에서 grep 가능)
export function logAction(action, data) {
  send("info", `[ACTION] ${action}`, data);
}
