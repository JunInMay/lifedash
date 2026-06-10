import { useEffect, useState } from "react";
import { SYMBOL_GROUPS, ALL_SYMBOLS, symbolName } from "./symbols";
import { fetchChart, fmtPrice, fmtPct, trendColor } from "./api";
import Chart from "./Chart";
import "./markets.css";

const RANGES = [
  { id: "1d", label: "1일", interval: "5m" },
  { id: "5d", label: "1주", interval: "30m" },
  { id: "1mo", label: "1개월", interval: "1d" },
  { id: "1y", label: "1년", interval: "1d" },
];

const CHART_REFRESH_MS = 60_000; // 선택 지표 갱신 주기
const QUOTE_GAP_MS = 400; // 목록 등락률 순차 조회 간격
const QUOTE_CYCLE_REST_MS = 180_000; // 전체 순회 후 휴식

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function MarketsPlugin({ storage }) {
  const [symbol, setSymbol] = useState(() => storage.get("symbol", "^KS11"));
  const [rangeId, setRangeId] = useState(() => storage.get("range", "1d"));
  const [chart, setChart] = useState(null);
  const [error, setError] = useState(null);
  const [quotes, setQuotes] = useState({});

  // 선택 지표 차트: 즉시 조회 + 주기 갱신
  useEffect(() => {
    let alive = true;
    const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[0];

    const load = async () => {
      try {
        const data = await fetchChart(symbol, range.id, range.interval);
        if (!alive) return;
        setChart(data);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err.message);
      }
    };

    setChart(null);
    setError(null);
    load();
    const timer = setInterval(load, CHART_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [symbol, rangeId]);

  // 목록 등락률: 전체 심볼을 순차 조회해 점진적으로 채움 (API 부하 분산)
  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        for (const s of ALL_SYMBOLS) {
          if (!alive) return;
          try {
            const d = await fetchChart(s.symbol, "1d", "1d");
            if (!alive) return;
            setQuotes((q) => ({ ...q, [s.symbol]: d.changePct }));
          } catch {
            // 개별 심볼 실패는 무시하고 계속
          }
          await sleep(QUOTE_GAP_MS);
        }
        await sleep(QUOTE_CYCLE_REST_MS);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const select = (next) => {
    setSymbol(next);
    storage.set("symbol", next);
  };

  const selectRange = (id) => {
    setRangeId(id);
    storage.set("range", id);
  };

  const color = trendColor(chart?.changePct);

  return (
    <div className="mkt-root">
      <div className="mkt-main">
        <div className="mkt-head">
          <span className="mkt-name">{symbolName(symbol)}</span>
          <span className="mkt-price">{fmtPrice(chart?.price)}</span>
          <span className="mkt-change" style={{ color }}>
            {fmtPct(chart?.changePct)}
          </span>
        </div>
        <div className="mkt-ranges">
          {RANGES.map((r) => (
            <button
              key={r.id}
              className={`mkt-range-btn ${r.id === rangeId ? "active" : ""}`}
              onClick={() => selectRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {chart ? (
          <Chart points={chart.points} prevClose={chart.prevClose} color={color} />
        ) : (
          <div className="mkt-status">{error ? `조회 실패: ${error}` : "불러오는 중..."}</div>
        )}
      </div>

      <div className="mkt-side">
        {SYMBOL_GROUPS.map((group) => (
          <div key={group.name}>
            <div className="mkt-group">{group.name}</div>
            {group.items.map((item) => (
              <button
                key={item.symbol}
                className={`mkt-item ${item.symbol === symbol ? "active" : ""}`}
                onClick={() => select(item.symbol)}
              >
                <span className="mkt-item-name">{item.name}</span>
                <span className="mkt-item-pct" style={{ color: trendColor(quotes[item.symbol]) }}>
                  {fmtPct(quotes[item.symbol])}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MarketsPlugin;
