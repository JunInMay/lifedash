import { useEffect, useState } from "react";
import { openExternal } from "../../core/desktop";
import { COUNTRIES, fetchHeadlines, timeAgo } from "./api";
import "./news.css";

const REFRESH_MS = 5 * 60_000;

function NewsPlugin({ storage }) {
  const [codes, setCodes] = useState(() => storage.get("countries", ["KR", "US"]));
  const [items, setItems] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setBusy(true);
      try {
        const list = await fetchHeadlines(codes);
        if (!alive) return;
        setItems(list);
        setUpdatedAt(new Date());
        setError(list.length === 0 ? "헤드라인을 가져오지 못했습니다." : null);
      } catch (err) {
        if (alive) setError(String(err?.message ?? err));
      } finally {
        if (alive) setBusy(false);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [codes]);

  const toggle = (code) => {
    const next = codes.includes(code)
      ? codes.filter((c) => c !== code)
      : [...codes, code];
    if (next.length === 0) return; // 최소 1개 국가 유지
    setCodes(next);
    storage.set("countries", next);
  };

  const open = (link) => openExternal(link); // 데스크탑: 기본 브라우저, dev: 새 탭

  return (
    <div className="news-root">
      <div className="news-head">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            className={`news-chip ${codes.includes(c.code) ? "active" : ""}`}
            onClick={() => toggle(c.code)}
          >
            {c.flag} {c.label}
          </button>
        ))}
        <div className="news-refresh">
          {updatedAt && <span className="news-updated">{timeAgo(updatedAt)} 갱신</span>}
          <button
            className="widget-btn"
            title="새로고침"
            onClick={() => {
              // codes 재설정으로 로드 effect 재실행
              setCodes([...codes]);
            }}
            disabled={busy}
          >
            {busy ? "..." : "↻"}
          </button>
        </div>
      </div>

      {error && items.length === 0 ? (
        <div className="news-status error">{error}</div>
      ) : items.length === 0 ? (
        <div className="news-status">헤드라인 불러오는 중...</div>
      ) : (
        <div className="news-list">
          {items.map((it, i) => (
            <button key={i} className="news-item" onClick={() => open(it.link)}>
              <div className="news-title">
                {it.flag} {it.title}
              </div>
              <div className="news-meta">
                {it.source} · {timeAgo(it.pubDate)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default NewsPlugin;
