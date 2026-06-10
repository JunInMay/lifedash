# Suggested Commands

- Install deps: `npm install`.
- Browser-only dev: `npm run dev`.
- Tauri desktop dev: `npm run tauri dev`.
- Production frontend build: `npm run build`.
- Preview built frontend: `npm run preview`.
- Tauri CLI passthrough: `npm run tauri -- <args>`.
- Build/package Tauri app: `npm run tauri build`.
- Windows/PowerShell file listing fallback because `rg` may be unavailable in this environment:
  - Top-level files: `Get-ChildItem -Force`.
  - Recursive source files: `Get-ChildItem -Recurse -File src`.
  - Search text: `Get-ChildItem -Recurse -File src | Select-String -Pattern '<pattern>'`.
- If Rust/Tauri HTTPS revocation checks fail on Windows dev machines, run in the same PowerShell session: `$env:CARGO_HTTP_CHECK_REVOKE = "false"; npm run tauri dev`.
- Avoid recursive listing of `src-tauri` without excluding `target`; it is large generated output.