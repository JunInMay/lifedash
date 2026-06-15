# Suggested Commands

- Install deps: `npm install`.
- Desktop dev for the user: `npm run electron:dev` (uses Vite port 1430). Agents should not occupy 1430 for routine verification.
- Browser-only agent verification: `npm run dev -- --port 1435`; stop it after checking and confirm the port is free with `Get-NetTCPConnection -LocalPort 1435 -State Listen`.
- Production frontend build: `npm run build`.
- Preview built frontend: `npm run preview`.
- Electron production-style start: `npm run electron:start`.
- Electron smoke test after build: `$env:LIFEDASH_SMOKE='1'; npx electron .`.
- Build/package Electron app: `npm run dist`.
- Windows/PowerShell file listing fallback because `rg` may be unavailable in this environment:
  - Top-level files: `Get-ChildItem -Force`.
  - Recursive source files: `Get-ChildItem -Recurse -File src`.
  - Search text: `Get-ChildItem -Recurse -File src | Select-String -Pattern '<pattern>'`.
- If Electron binaries need reinstalling in the corporate network, set `$env:NODE_EXTRA_CA_CERTS = 'C:\LF_WIDE\bin\ssl_cert\dev_napi.lfmall.co.kr_2.cer'` before `npm install`.