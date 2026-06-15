# Task Completion

- There is no configured linter, formatter, unit test runner, or TypeScript checker in `package.json`.
- Minimum validation after frontend changes: `npm run build`.
- For runtime/UI changes, prefer browser verification on `npm run dev -- --port 1435`; do not use 1430 because it is reserved for the user's `npm run electron:dev` flow. Stop the dev server after checking.
- For Electron bridge/main/preload changes: run `npm run build` and, when practical, `$env:LIFEDASH_SMOKE='1'; npx electron .` to verify production file:// loading, bridge presence, board render, and IPC fetch.
- For desktop-only UI features such as `<webview>`, file picker, local video playback, or real Electron window behavior, ask the user to run/check `npm run electron:dev` if visual confirmation is required.
- For network plugins, verify both paths if touched:
  - Electron path via `desktopFetch` / main-process `net.fetch`.
  - Browser dev path via Vite proxy configuration.
- Before finalizing changes, check generated output was not accidentally included; especially `dist`, `node_modules`, `release`, and temporary dev-server logs.
- If documentation was changed, keep `CLAUDE.md`, relevant `spec/<plugin>.md`, `tasks/TODO.md`, and Serena memories consistent with the current runtime.