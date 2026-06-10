// Yahoo Finance v8 chart API 호출 래퍼.
// - Tauri 앱: tauri-plugin-http로 직접 호출 (CORS 없음)
// - 브라우저(npm run dev): vite 프록시 "/yahoo" 경유
const BASE = "https://query1.finance.yahoo.com";

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

async function yahooGet(path) {
  if (isTauri()) {
    try {
      const { fetch: httpFetch } = await import("@tauri-apps/plugin-http");
      const res = await httpFetch(BASE + path, { method: "GET" });
      return await res.json();
    } catch {
      // tauri dev에서는 페이지가 vite 서버에서 서빙되므로 프록시 fallback 가능
    }
  }
  const res = await fetch("/yahoo" + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * 지표 차트 조회.
 * @returns {{ symbol, price, prevClose, changePct, points: [{t, v}] }}
 */
export async function fetchChart(symbol, range = "1d", interval = "5m") {
  const path =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}&includePrePost=false`;
  const json = await yahooGet(path);

  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error(json?.chart?.error?.description ?? "데이터 없음");
  }

  const meta = result.meta ?? {};
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points = timestamps
    .map((t, i) => ({ t, v: closes[i] }))
    .filter((p) => p.v != null);

  const price = meta.regularMarketPrice ?? points.at(-1)?.v ?? null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? points[0]?.v ?? null;
  const changePct =
    price != null && prevClose ? ((price - prevClose) / prevClose) * 100 : null;

  return { symbol, price, prevClose, changePct, points };
}

/** 숫자 표시용 포맷 (큰 수는 소수점 절삭) */
export function fmtPrice(n) {
  if (n == null) return "-";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(n) {
  if (n == null) return "";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/** 상승 빨강 / 하락 파랑 (국내 관례) */
export function trendColor(n) {
  if (n == null || n === 0) return "#8b93a3";
  return n > 0 ? "#f87171" : "#60a5fa";
}
