# Core

- App is an Electron 42 desktop personal dashboard with a Vite/React frontend. It was migrated from Tauri on 2026-06-12; `src-tauri/` is no longer in the working tree and only remains in git history.
- Frontend entry: `src/main.jsx` -> `src/App.jsx` -> `src/core/Dashboard.jsx`.
- Dashboard owns plugin instance lifecycle and layout persistence; plugins do not know their board position.
- Core plugin shell:
  - `src/core/PluginRegistry.js`: eager `import.meta.glob("../plugins/*/index.jsx")` plus matching `manifest.json` files.
  - `src/core/Dashboard.jsx`: loads/saves `lifedash.layout`, adds/removes instances, cascades initial positions.
  - `src/core/PluginCard.jsx`: wraps plugin with `react-draggable` and `react-resizable`, injects `{ instanceId, storage, bus, width, height }`; optional `Component.Settings` appears as a card-header settings overlay.
  - `src/core/PluginDrawer.jsx`: lists all registry plugins and calls `onAdd(manifest.id)`.
  - `src/core/storage.js`: localStorage layout, per-instance plugin storage, and shared plugin storage where needed.
  - `src/core/eventBus.js`: in-memory pub/sub; subscriber errors are isolated.
  - `src/core/desktop.js`: renderer helper for `window.lifedash` bridge (`desktopFetch`, `openExternal`, `toggleFullscreen`).
  - `src/core/WebviewEmbed.jsx`: Electron `<webview>` wrapper used by youtube/teams/browser.
- Native shell:
  - `electron/main.cjs`: BrowserWindow creation, IPC handlers, `net.fetch` bridge, `media://` protocol, notification blocking, smoke test.
  - `electron/preload.cjs`: exposes `window.lifedash` with CORS-free fetch, openExternal, file picker, fs exists, fullscreen, mediaSrc.
- Plugin convention: each plugin lives under `src/plugins/<id>/` with `index.jsx` default export and `manifest.json`; folder id should match `manifest.id`.
- Implemented plugins: aichat, browser, clock, dictionary, links, markets, news, notes, ricochetrobots, stocks, teams, timer, todo, translator, videoplayer, youtube.
- aichat layout note: auto-growing textarea must not cover messages. Keep `.plugin-body` and aichat flex containers shrinkable (`min-height: 0`) and keep `.chat-root` padding inside its 100% height (`box-sizing: border-box`).
- Generated/build directories present: `node_modules`, `dist`, `release`; ignore generated trees during analysis.

Read `mem:tech_stack` for framework/tooling versions and native capability details. Read `mem:conventions` for plugin/storage/event naming rules. Read `mem:suggested_commands` for day-to-day commands. Read `mem:task_completion` before finishing code changes.