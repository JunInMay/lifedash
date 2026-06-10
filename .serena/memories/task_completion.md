# Task Completion

- There is no configured linter, formatter, unit test runner, or TypeScript checker in `package.json`.
- Minimum validation after frontend changes: `npm run build`.
- Minimum validation after Tauri/native/capability changes: `npm run tauri build` when practical; otherwise at least `npm run build` plus targeted inspection of `src-tauri/capabilities/default.json`, `src-tauri/Cargo.toml`, and Tauri plugin initialization.
- For runtime/UI changes, run `npm run dev` for browser fallback checks or `npm run tauri dev` for desktop-only APIs such as plugin-http, opener, and child webview.
- For network plugins, verify both paths if touched:
  - Tauri path via `@tauri-apps/plugin-http` permissions/capability allowlist.
  - Browser dev path via Vite proxy configuration.
- Before finalizing changes, check generated output was not accidentally included; especially `dist`, `node_modules`, and `src-tauri/target`.