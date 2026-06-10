# Core

- App is a Tauri 2 desktop personal dashboard with a Vite/React frontend.
- Frontend entry: `src/main.jsx` -> `src/App.jsx` -> `src/core/Dashboard.jsx`.
- Dashboard owns plugin instance lifecycle and layout persistence; plugins do not know their board position.
- Core plugin shell:
  - `src/core/PluginRegistry.js`: eager `import.meta.glob("../plugins/*/index.jsx")` plus matching `manifest.json` files.
  - `src/core/Dashboard.jsx`: loads/saves `lifedash.layout`, adds/removes instances, cascades initial positions.
  - `src/core/PluginCard.jsx`: wraps plugin with `react-draggable` and `react-resizable`, injects `{ instanceId, storage, bus, width, height }`.
  - `src/core/PluginDrawer.jsx`: lists all registry plugins and calls `onAdd(manifest.id)`.
  - `src/core/storage.js`: localStorage layout and per-instance plugin storage.
  - `src/core/eventBus.js`: in-memory pub/sub; subscriber errors are isolated.
- Plugin convention: each plugin lives under `src/plugins/<id>/` with `index.jsx` default export and `manifest.json`; folder id should match `manifest.id`.
- Implemented plugins: clock, dictionary, links, markets, notes, timer, todo, translator, youtube.
- Tauri native layer is thin: `src-tauri/src/main.rs` calls `lifedash_fable_lib::run()`, and `src-tauri/src/lib.rs` initializes `tauri-plugin-http` and `tauri-plugin-opener`.
- Generated/build directories present: `node_modules`, `dist`, `src-tauri/target`; ignore generated trees during analysis.
- `.gitignore` ignores `node_modules` and `dist` but currently does not ignore `src-tauri/target`.

Read `mem:tech_stack` for framework/tooling versions and native capability details. Read `mem:conventions` for plugin/storage/event naming rules. Read `mem:suggested_commands` for day-to-day commands. Read `mem:task_completion` before finishing code changes.