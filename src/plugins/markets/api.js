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

// ---- 네이버 실시간 시세 (한국 전용) ----
// Yahoo의 KRX 데이터는 ~20분 지연이지만, 네이버 폴링 API는 무지연(delayTime: 0)이다.
// ac.stock.naver.com 등 다른 네이버 증권 호스트는 회사망에서 차단되지만
// polling.finance.naver.com은 차단되지 않는 것을 실측 확인 (2026-06-12).
// 실패 시 조용히 null을 반환해 Yahoo 값으로 폴백한다.
const NAVER_BASE = "https://polling.finance.naver.com";
const NAVER_INDEX = { "^KS11": "KOSPI", "^KQ11": "KOSDAQ", "^KS200": "KPI200" };

const parseNum = (s) => {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

function naverPathFor(symbol) {
  if (NAVER_INDEX[symbol]) return `/api/realtime/domestic/index/${NAVER_INDEX[symbol]}`;
  if (/^\d{6}\.(KS|KQ)$/.test(symbol)) return `/api/realtime/domestic/stock/${symbol.slice(0, 6)}`;
  return null;
}

/** 한국 지수/종목의 실시간 시세. 해당 없거나 실패하면 null. */
export async function fetchNaverRealtime(symbol) {
  const path = naverPathFor(symbol);
  if (!path) return null;
  try {
    let json;
    if (isTauri()) {
      try {
        const { fetch: httpFetch } = await import("@tauri-apps/plugin-http");
        const res = await httpFetch(NAVER_BASE + path, { method: "GET" });
        json = await res.json();
      } catch {
        json = null;
      }
    }
    if (!json) {
      const res = await fetch("/npoll" + path);
      if (!res.ok) return null;
      json = await res.json();
    }
    const d = json?.datas?.[0];
    const price = parseNum(d?.closePrice);
    if (price == null) return null;
    return {
      price,
      changePct: parseNum(d.fluctuationsRatio),
      volume: parseNum(d.accumulatedTradingVolume),
      marketTime: Math.floor(Date.now() / 1000), // 무지연이므로 현재 시각
    };
  } catch {
    return null;
  }
}

async function requestChart(symbol, range, interval) {
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

  return {
    symbol,
    price,
    prevClose,
    changePct,
    points,
    marketTime: meta.regularMarketTime ?? null, // 시세 기준 시각 (unix초) — KRX는 ~20분 지연
    gmtoffset: meta.gmtoffset ?? 0,
  };
}

/**
 * 지표 차트 조회.
 * ⚠️ Yahoo의 KRX(한국) 데이터는 ~20분 지연이라, 개장 직후 1d 요청은 당일 캔들이
 * 아예 없는 빈 응답이 온다 (실측: 09:10에 ^KS11 points=0, marketTime=전일).
 * 이때는 2d로 재요청해 마지막 거래일 세션을 잘라 보여준다 (차트가 비지 않게).
 * @returns {{ symbol, price, prevClose, changePct, points: [{t, v}], marketTime }}
 */
export async function fetchChart(symbol, range = "1d", interval = "5m") {
  let data = await requestChart(symbol, range, interval);

  if (range === "1d" && interval !== "1d" && data.points.length < 2) {
    const wide = await requestChart(symbol, "2d", interval);
    if (wide.points.length >= 2) {
      const day = (t) => Math.floor((t + wide.gmtoffset) / 86400);
      const lastDay = day(wide.points.at(-1).t);
      wide.points = wide.points.filter((p) => day(p.t) === lastDay);
      data = wide;
    }
  }

  // 한국 지수/종목: 네이버 실시간으로 헤더 시세 보정 (차트 곡선은 Yahoo 지연 데이터 유지)
  const rt = await fetchNaverRealtime(symbol);
  if (rt) {
    data.price = rt.price;
    if (rt.changePct != null) data.changePct = rt.changePct;
    data.marketTime = rt.marketTime;
  }
  return data;
}

/** 시세 기준 시각 표시 — 오늘이면 "HH:mm 기준", 아니면 "MM.DD HH:mm 기준" */
export function fmtMarketTime(unixSec) {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay ? `${hm} 기준` : `${d.getMonth() + 1}.${d.getDate()} ${hm} 기준`;
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
