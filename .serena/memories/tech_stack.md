# Tech Stack

- Frontend: JavaScript JSX, React `^19.1.0`, ReactDOM `^19.1.0`, Vite `^7.0.4`, `@vitejs/plugin-react` `^4.6.0`.
- Desktop shell: Tauri `2`, Rust edition 2021, `@tauri-apps/api` `^2`, `@tauri-apps/cli` `^2`.
- Tauri plugins:
  - `tauri-plugin-http` / `@tauri-apps/plugin-http` for CORS-free external HTTP in desktop runtime.
  - `tauri-plugin-opener` / `@tauri-apps/plugin-opener` for opening URLs externally.
- UI mechanics: `react-draggable` `^4.6.0`, `react-resizable` `^4.0.1`.
- Package manager: npm with committed `package-lock.json`.
- Vite dev server is fixed to port `1430` with `strictPort: true`; Tauri dev URL is `http://localhost:1430`.
- Vite proxies used only for browser dev fallback:
  - `/yahoo` -> `https://query1.finance.yahoo.com`.
  - `/gtx` -> `https://translate.googleapis.com`.
- Tauri capabilities in `src-tauri/capabilities/default.json` allow:
  - opener default permission.
  - child webview create/close/set-position/set-size for youtube plugin.
  - HTTP URLs for Yahoo Finance, Google Translate, Anthropic API.
- `tauri = { version = "2", features = ["unstable"] }` is required for child webview usage.
- No TypeScript config is present despite Serena detecting TypeScript; source files are `.js` and `.jsx`.
- No lint/test/typecheck tooling is currently configured in `package.json`.