import { useEffect, useRef, useState } from "react";
import { searchSymbols, fetchQuote, fetchFundamentals, fmtBig, fmtRatio } from "./api";
import { fmtPrice, fmtPct, trendColor, fmtMarketTime } from "../markets/api";
import Chart from "../markets/Chart";
import "./stocks.css";

const SEARCH_DEBOUNCE_MS = 400;

function StocksPlugin({ storage }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [favorites, setFavorites] = useState(() => storage.get("favorites", []));
  const [symbol, setSymbol] = useState(() => storage.get("symbol", null));
  // 내장 테이블/검색 결과의 표시명 (Yahoo meta.shortName은 "SamsungElec"처럼 축약됨)
  const [symbolName, setSymbolName] = useState(() => storage.get("symbolName", null));
  const [quote, setQuote] = useState(null);
  const [fin, setFin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0); // 같은 종목 재클릭 시 강제 재조회
  const debounceRef = useRef(0);

  // 검색어 디바운스
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setResults(await searchSymbols(q));
      } catch {
        setResults([]);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // 선택 종목 상세 로드 + 60초 자동 갱신 (시세만 — 재무는 종목당 1회면 충분)
  useEffect(() => {
    if (!symbol) return;
    let alive = true;

    const loadQuote = async (isFirst) => {
      try {
        const q = await fetchQuote(symbol);
        if (!alive) return;
        setQuote(q);
        if (!isFirst) setError(null);
      } catch (err) {
        // 주기 갱신 실패는 기존 화면 유지 (일시적 네트워크 오류 등)
        if (alive && isFirst) setError(String(err?.message ?? err));
      } finally {
        if (alive && isFirst) setBusy(false);
      }
    };

    setBusy(true);
    setError(null);
    setQuote(null);
    setFin(null);
    (async () => {
      await loadQuote(true);
      try {
        const f = await fetchFundamentals(symbol);
        if (alive) setFin(f);
      } catch {
        if (alive) setFin({});
      }
    })();

    const timer = setInterval(() => loadQuote(false), 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [symbol, reloadTick]);

  const select = (item) => {
    if (item.symbol === symbol) setReloadTick((t) => t + 1); // 재클릭 = 수동 새로고침
    setSymbol(item.symbol);
    setSymbolName(item.name);
    storage.set("symbol", item.symbol);
    storage.set("symbolName", item.name);
    // 즐겨찾기 클릭 시 검색창 비워 즐겨찾기 목록 유지
    if (results.length > 0) setQuery("");
  };

  const displayName = symbolName ?? quote?.name;
  const isFav = favorites.some((f) => f.symbol === quote?.symbol);
  const toggleFav = () => {
    if (!quote) return;
    const next = isFav
      ? favorites.filter((f) => f.symbol !== quote.symbol)
      : [...favorites, { symbol: quote.symbol, name: displayName ?? quote.symbol }];
    setFavorites(next);
    storage.set("favorites", next);
  };

  const color = trendColor(quote?.changePct);
  const annual = (key) => fin?.[key] ?? [];
  const finRows = quote && fin && [
    { label: "시가총액", value: fmtBig(fin.trailingMarketCap, quote.currency) },
    { label: "PER", value: fmtRatio(fin.trailingPeRatio) },
    { label: "PBR", value: fmtRatio(fin.trailingPbRatio) },
    { label: "거래량", value: quote.volume == null ? "-" : quote.volume.toLocaleString() },
    { label: "52주 최고", value: fmtPrice(quote.high52) },
    { label: "52주 최저", value: fmtPrice(quote.low52) },
    ...annual("annualTotalRevenue").map((e) => ({
      label: `매출 ${e.date}`,
      value: fmtBig(e.value, quote.currency),
    })),
    ...annual("annualOperatingIncome").map((e) => ({
      label: `영업이익 ${e.date}`,
      value: fmtBig(e.value, quote.currency),
    })),
    ...annual("annualNetIncome").map((e) => ({
      label: `순이익 ${e.date}`,
      value: fmtBig(e.value, quote.currency),
    })),
  ];

  const sideItems = query.trim() ? results : favorites;

  return (
    <div className="stk-root">
      <div className="stk-main">
        {error && <div className="stk-status error">{error}</div>}
        {!error && !quote && (
          <div className="stk-status">
            {busy ? "불러오는 중..." : "우측에서 종목을 검색하세요\n(예: 삼성전자, AAPL, QQQ)"}
          </div>
        )}
        {!error && quote && (
          <>
            <div className="stk-head">
              <span className="stk-name">{displayName}</span>
              <span className="stk-symbol">{quote.symbol}</span>
              <button
                className={`stk-star ${isFav ? "on" : ""}`}
                title={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                onClick={toggleFav}
              >
                {isFav ? "★" : "☆"}
              </button>
            </div>
            <div className="stk-price-row">
              <span className="stk-price">{fmtPrice(quote.price)}</span>
              <span className="stk-change" style={{ color }}>
                {fmtPct(quote.changePct)}
              </span>
              <span className="stk-symbol">
                {quote.currency} · 3개월 · {fmtMarketTime(quote.marketTime)}
              </span>
            </div>
            <div className="stk-chart">
              <Chart points={quote.points} prevClose={quote.prevClose} color={color} />
            </div>
            <div className="stk-fin">
              {(finRows ?? []).map((row) => (
                <div key={row.label} className="stk-fin-item">
                  <span className="stk-fin-label">{row.label}</span>
                  <span className="stk-fin-value">{row.value}</span>
                </div>
              ))}
              {quote && fin === null && (
                <div className="stk-fin-item">
                  <span className="stk-fin-label">재무지표 불러오는 중...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="stk-side">
        <input
          className="widget-input"
          value={query}
          placeholder="종목/ETF 검색"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="stk-side-head">{query.trim() ? "검색 결과" : "★ 즐겨찾기"}</div>
        <div className="stk-side-list">
          {sideItems.length === 0 && (
            <div className="stk-empty">
              {query.trim() ? "결과가 없습니다" : "★를 눌러 종목을 즐겨찾기에 추가하세요"}
            </div>
          )}
          {sideItems.map((item) => (
            <button
              key={item.symbol}
              className={`stk-item ${item.symbol === symbol ? "active" : ""}`}
              onClick={() => select(item)}
            >
              <span className="stk-item-name">
                {item.name}
                <span className="stk-item-sub">{item.symbol}</span>
              </span>
              {item.type && <span className="stk-item-tag">{item.type === "ETF" ? "ETF" : ""}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StocksPlugin;
