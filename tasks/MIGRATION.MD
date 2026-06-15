# Electron Migration Notes

## Background

The current app is a Tauri v2 desktop app. Most plugins are normal React DOM
widgets, but the `youtube`, `teams`, and `browser` plugins use Tauri child
webviews through `src/core/useChildWebview.js`.

That hook creates a native child webview with `new Webview(...)` and then tracks
the React card body's DOM rectangle with `requestAnimationFrame`, updating the
native webview position and size.

This works for showing sites that cannot be embedded in an iframe, but it does
not behave like normal card content.

## Problem Observed

When a normal plugin card or the plugin drawer overlaps a webview plugin:

- The webview plugin's React/DOM shell is covered correctly.
- The webview plugin's native webview surface remains above the overlapping DOM.
- This makes the webview appear to punch through higher z-index cards or drawers.

This is not a simple CSS `z-index` issue. The card shell and drawer live in the
main webview's DOM layer, while the Tauri child webview is a separate native
surface. DOM stacking, clipping, `overflow: hidden`, and border radius do not
compose with it as if it were card content.

Practical Tauri-side mitigations include:

- Hide/show webviews while drawers or overlapping cards are active.
- Prevent webview cards from overlapping other cards.
- Force webview cards to stay above all normal cards.

These avoid the visual glitch, but they do not preserve the desired UX: webview
plugins behaving exactly like ordinary dashboard cards.

## Electron PoC

An isolated Electron proof of concept was created under:

```text
electron-poc/
```

It is intentionally a separate project with its own `package.json`, dependencies,
Vite config, and Electron entry point. The existing Tauri app was not converted.

Important files:

- `electron-poc/package.json`
- `electron-poc/main.js`
- `electron-poc/vite.config.js`
- `electron-poc/src/App.jsx`
- `electron-poc/src/style.css`

The PoC uses Electron's `<webview>` tag, enabled via:

```js
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webviewTag: true
}
```

The test UI contains:

- `A: DOM Card` - a normal draggable React card.
- `B: YouTube Webview` - a card containing `<webview src="https://www.youtube.com">`.
- `C: Example Webview` - a card containing `<webview src="https://example.com">`.
- `DOM Drawer` - a fixed-position React drawer with high z-index.

## PoC Setup Notes

Initial Electron launch failed because `electron-poc/package.json` did not define
the Electron entry point. This was fixed with:

```json
"main": "main.js"
```

The first production start also showed a black window because Vite emitted
absolute asset paths such as `/assets/...`, which do not work correctly when
Electron loads `dist/index.html` via `file://`. This was fixed with:

```js
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    strictPort: true,
    port: 5174
  }
});
```

Dependency installation initially failed during Electron binary download with:

```text
self-signed certificate in certificate chain
```

The environment already had an npm `cafile`, but Electron's install download
needed the certificate passed through Node TLS directly:

```powershell
$env:NODE_EXTRA_CA_CERTS='C:\LF_WIDE\bin\ssl_cert\dev_napi.lfmall.co.kr_2.cer'
npm install
```

## How To Run The PoC

```powershell
cd D:\VibeProjects\lifedash-fable\electron-poc
npm start
```

If dependencies must be reinstalled in the same certificate environment:

```powershell
cd D:\VibeProjects\lifedash-fable\electron-poc
$env:NODE_EXTRA_CA_CERTS='C:\LF_WIDE\bin\ssl_cert\dev_napi.lfmall.co.kr_2.cer'
npm install
npm run build
npm start
```

The production path (`npm start`) is currently the reliable test path. The dev
script may need additional adjustment.

## PoC Result

The PoC validates the important layering behavior:

- A normal DOM card can cover an Electron `<webview>` card.
- The drawer can appear above an Electron `<webview>`.
- The webview behaves like card content for stacking and clipping in the tested
  scenario.

This directly addresses the visual failure seen with Tauri child webviews.

## Migration Implication

Electron is a credible migration path if the product requirement is:

> Webview plugins must behave like normal dashboard cards, including overlap,
> z-index, clipping, and drawer coverage.

The key is to use Electron's DOM-integrated `<webview>` tag for these plugins.
Using Electron `BrowserView` or `WebContentsView` may reintroduce a native-view
stacking model similar to the current Tauri child webview issue.

## Migration Risks

- Electron increases app size and memory use compared with Tauri.
- Electron `<webview>` must be configured carefully for security.
- Tauri APIs currently used by plugins must be replaced with Electron IPC or web
  alternatives:
  - `@tauri-apps/api`
  - `@tauri-apps/plugin-http`
  - `@tauri-apps/plugin-fs`
  - `@tauri-apps/plugin-dialog`
  - `@tauri-apps/plugin-opener`
- Build, packaging, signing, and update flows would move from Tauri tooling to
  Electron tooling.
- External-site behavior such as popups, permissions, cookies, and login sessions
  must be re-tested for YouTube, Teams, and arbitrary browser URLs.

## Suggested Migration Plan

1. Keep the current Tauri app intact while planning the migration.
2. Convert the existing plugin runtime shell to Electron in a branch or isolated
   directory.
3. Replace `useChildWebview.js` with a React component using Electron `<webview>`.
4. Port only `youtube`, `teams`, and `browser` first.
5. Verify card drag, resize, z-order, drawer overlay, fullscreen, and session
   persistence.
6. Port Tauri-specific APIs to Electron IPC only after the webview-card behavior
   is confirmed in the real app shell.

## Current Recommendation

Do not treat Tauri hide/show as a full fix if the intended UX is freeform
overlapping dashboard cards. It is a workaround.

For the desired card model, Electron with `<webview>` is the better-fitting
architecture based on the PoC result.
