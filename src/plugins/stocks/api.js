// 종목 검색/시세/재무지표 — 전부 Yahoo Finance (무료, 키 불필요), query1 단일 호스트.
//
// ⚠️ 재무 데이터 소스 선택 이유 (중요):
// Yahoo의 정식 재무 엔드포인트인 v10 quoteSummary는 2023년부터 crumb+쿠키 인증이
// 필요해져서 keyless 호출이 401로 막힌다. 대신 Yahoo 재무 차트 페이지가 쓰는
// `/ws/fundamentals-timeseries/v1/finance/timeseries/{symbol}` 엔드포인트는
// 인증 없이 동작하며 PER/PBR/시총/매출/영업이익/순이익 시계열을 준다.
// 이 엔드포인트가 막히면 quoteSummary + crumb 흐름(fc.yahoo.com 쿠키 →
// /v1/test/getcrumb)으로의 전환을 검토할 것.

import { hasHangul, searchKrSymbols } from "./krSymbols";
import { fetchNaverRealtime } from "../markets/api";

const BASE = "https://query1.finance.yahoo.com";

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

async function yahooGet(path) {
  if (isTauri()) {
    try {
      const { fetch: httpFetch } = await import("@tauri-apps/plugin-http");
      const res = await httpFetch(BASE + path, { method: "GET" });
      return await res.json();
    } catch {
      // tauri dev에서는 vite 프록시로 fallback 가능
    }
  }
  const res = await fetch("/yahoo" + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * 종목/ETF 검색.
 * ⚠️ Yahoo 검색 API는 한글 쿼리를 400(Invalid Search Query)으로 거부한다 (실측 확인).
 * 네이버 증권 API는 사용자의 회사망에서 차단되어 쓸 수 없으므로,
 * 한글 검색어는 내장 한국 주요 종목 테이블(krSymbols.js)로 처리한다.
 * 영문명("samsung")·종목코드("005930")는 Yahoo 검색이 한국 종목까지 커버한다.
 */
export async function searchSymbols(query) {
  if (hasHangul(query)) return searchKrSymbols(query);
  const json = await yahooGet(
    `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0&listsCount=0`
  );
  return (json.quotes ?? [])
    .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
    .map((q) => ({
      symbol: q.symbol,
      name: q.shortname ?? q.longname ?? q.symbol,
      type: q.quoteType,
      exchange: q.exchDisp ?? q.exchange ?? "",
    }));
}

/** 시세 + 3개월 일봉 차트 + 거래량 (v8 chart API) */
export async function fetchQuote(symbol) {
  const json = await yahooGet(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&includePrePost=false`
  );
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description ?? "시세 데이터 없음");

  const meta = result.meta ?? {};
  const ts = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const closes = q.close ?? [];
  const volumes = q.volume ?? [];
  const points = ts.map((t, i) => ({ t, v: closes[i] })).filter((p) => p.v != null);

  const price = meta.regularMarketPrice ?? points.at(-1)?.v ?? null;
  // ⚠️ range=3mo에서 meta.chartPreviousClose는 "전일 종가"가 아니라 "3개월 전 종가"다.
  // 일간 등락률은 마지막에서 두 번째 일봉 종가 기준으로 계산한다.
  const prevClose = points.length >= 2 ? points.at(-2).v : meta.chartPreviousClose ?? null;
  const lastVolume = [...volumes].reverse().find((v) => v != null) ?? null;

  const quote = {
    symbol,
    name: meta.shortName ?? meta.longName ?? symbol,
    currency: meta.currency ?? "USD",
    price,
    prevClose,
    changePct: price != null && prevClose ? ((price - prevClose) / prevClose) * 100 : null,
    volume: lastVolume,
    high52: meta.fiftyTwoWeekHigh ?? null,
    low52: meta.fiftyTwoWeekLow ?? null,
    points,
    // 시세 기준 시각. Yahoo의 KRX 데이터는 ~20분 지연이라 아래에서 네이버 실시간으로 보정.
    marketTime: meta.regularMarketTime ?? null,
  };

  // 한국 종목: 네이버 실시간(무지연)으로 가격/등락률/거래량 보정. 실패 시 Yahoo 값 유지.
  const rt = await fetchNaverRealtime(symbol);
  if (rt) {
    quote.price = rt.price;
    if (rt.changePct != null) quote.changePct = rt.changePct;
    if (rt.volume != null) quote.volume = rt.volume;
    quote.marketTime = rt.marketTime;
  }
  return quote;
}

const TS_TYPES = [
  "trailingPeRatio",
  "trailingPbRatio",
  "trailingMarketCap",
  "annualTotalRevenue",
  "annualOperatingIncome",
  "annualNetIncome",
];

/** 재무지표 (fundamentals-timeseries — 인증 불필요, 상단 주석 참조) */
export async function fetchFundamentals(symbol) {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 60 * 60 * 24 * 365 * 5; // 5년치
  const json = await yahooGet(
    `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}` +
      `?symbol=${encodeURIComponent(symbol)}&type=${TS_TYPES.join(",")}` +
      `&period1=${period1}&period2=${period2}&merge=false&padTimeSeries=true`
  );

  const out = {};
  for (const r of json?.timeseries?.result ?? []) {
    const type = r.meta?.type?.[0];
    if (!type) continue;
    const entries = (r[type] ?? []).filter((e) => e && e.reportedValue?.raw != null);
    if (entries.length === 0) continue;
    if (type.startsWith("annual")) {
      // 연간 항목은 최근 2개 연도 [{date, value}]
      out[type] = entries.slice(-2).map((e) => ({
        date: (e.asOfDate ?? "").slice(0, 4),
        value: e.reportedValue.raw,
      }));
    } else {
      out[type] = entries.at(-1).reportedValue.raw; // trailing 항목은 최신값
    }
  }
  return out;
}

/** 큰 수 표기: KRW는 조/억, 그 외는 T/B/M */
export function fmtBig(v, currency) {
  if (v == null) return "-";
  const abs = Math.abs(v);
  if (currency === "KRW") {
    if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
    if (abs >= 1e8) return `${Math.round(v / 1e8).toLocaleString()}억`;
    return v.toLocaleString();
  }
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return v.toLocaleString();
}

export function fmtRatio(v) {
  return v == null ? "-" : v.toFixed(2);
}
