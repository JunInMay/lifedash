import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  define: {
    "process.env": {},
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1430,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1431,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      // 브라우저 dev에서 Yahoo Finance CORS 우회 (Tauri 앱은 plugin-http로 직접 호출)
      "/yahoo": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        // 사내망 SSL 인터셉션(자체 서명 인증서) 환경에서도 동작하도록 검증 생략
        secure: false,
        rewrite: (path) => path.replace(/^\/yahoo/, ""),
      },
      // 번역기·사전(영한) 플러그인: 무료 구글 번역 엔드포인트
      "/gtx": {
        target: "https://translate.googleapis.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/gtx/, ""),
      },
      // 사전(영영) 플러그인: Free Dictionary API
      "/dict": {
        target: "https://api.dictionaryapi.dev",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/dict/, ""),
      },
    },
  },
}));
