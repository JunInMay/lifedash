import { useState, useCallback } from "react";
import { EXPRESSIONS, TYPE_COLORS } from "./data";
import { generateExpressions } from "./aiGen";
import "./engexpr.css";

const CARD_COUNT = 5;

const PROVIDERS = [
  { id: "claude", label: "Claude", defaultModel: "claude-haiku-4-5", placeholder: "sk-ant-..." },
  { id: "openai", label: "ChatGPT", defaultModel: "gpt-4o-mini", placeholder: "sk-..." },
];

function getAllExpressions(extraPool) {
  const base = EXPRESSIONS;
  const baseIds = new Set(base.map((e) => e.id));
  const extras = extraPool.filter((e) => !baseIds.has(e.id));
  return [...base, ...extras];
}

function pickRandom(pool, exclude = []) {
  const available = pool.filter((e) => !exclude.includes(e.id));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function initSlots(familiar, pool) {
  const used = [];
  return Array.from({ length: CARD_COUNT }, () => {
    const item = pickRandom(pool, [...familiar, ...used]);
    if (item) used.push(item.id);
    return item;
  });
}

function TypeBadge({ type }) {
  const color = TYPE_COLORS[type] ?? { bg: "#1f2937", text: "#9ca3af" };
  return (
    <span className="engexpr-type-badge" style={{ background: color.bg, color: color.text }}>
      {type}
    </span>
  );
}

function ExprCard({ item, bookmarked, onRefresh, onBookmark, onGotIt }) {
  if (!item) return null;
  return (
    <div className="engexpr-card">
      <div className="engexpr-card-body">
        <TypeBadge type={item.type} />
        <div className="engexpr-expression">{item.expression}</div>
        <div className="engexpr-usage">{item.usage}</div>
        <div className="engexpr-example">"{item.example}"</div>
      </div>
      <div className="engexpr-card-actions">
        <div className="engexpr-card-actions-row">
          <button
            className={`engexpr-btn-bookmark${bookmarked ? " active" : ""}`}
            title={bookmarked ? "Remove bookmark" : "Bookmark this"}
            onClick={onBookmark}
          >
            🔖
          </button>
          <button className="engexpr-btn-refresh" title="Refresh this card" onClick={onRefresh}>
            ↻
          </button>
        </div>
        <button className="engexpr-btn-gotit" title="Mark as familiar" onClick={onGotIt}>
          ✓ Got it!
        </button>
      </div>
    </div>
  );
}

function Popup({ title, items, emptyMsg, removeTitle, onRemove, onClose }) {
  return (
    <div className="engexpr-overlay" onMouseDown={onClose}>
      <div className="engexpr-popup" onMouseDown={(e) => e.stopPropagation()}>
        <div className="engexpr-popup-header">
          <h3>{title}</h3>
          <button className="engexpr-popup-close" onClick={onClose}>✕</button>
        </div>
        <div className="engexpr-popup-list">
          {items.length === 0 ? (
            <div className="engexpr-popup-empty">{emptyMsg}</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="engexpr-popup-item">
                <TypeBadge type={item.type} />
                <span className="engexpr-popup-expr">{item.expression}</span>
                <button className="engexpr-popup-remove" title={removeTitle} onClick={() => onRemove(item.id)}>
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

function Settings({ storage }) {
  const [provider, setProvider] = useState(() => storage.get("aiProvider", "claude"));
  const [apiKey, setApiKey] = useState(() => storage.get("aiKey", ""));
  const [model, setModel] = useState(() => {
    const saved = storage.get("aiModel", null);
    return saved ?? PROVIDERS.find((p) => p.id === storage.get("aiProvider", "claude"))?.defaultModel ?? "";
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [showPool, setShowPool] = useState(false);
  const [extraPool, setExtraPool] = useState(() => storage.get("extraPool", []));
  const totalPool = getAllExpressions(extraPool);

  const saveProvider = (id) => {
    setProvider(id);
    storage.set("aiProvider", id);
    const def = PROVIDERS.find((p) => p.id === id)?.defaultModel ?? "";
    setModel(def);
    storage.set("aiModel", def);
  };

  const saveKey = (val) => {
    setApiKey(val);
    storage.set("aiKey", val);
  };

  const saveModel = (val) => {
    setModel(val);
    storage.set("aiModel", val);
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) { setStatus({ error: "Enter an API key first." }); return; }
    setBusy(true);
    setStatus(null);
    try {
      const existingIds = totalPool.map((e) => e.id);
      const { added, skipped } = await generateExpressions(
        { provider, apiKey: apiKey.trim(), model },
        existingIds
      );
      const nextPool = [...extraPool, ...added];
      storage.set("extraPool", nextPool);
      setExtraPool(nextPool);
      setStatus({ ok: `Added ${added.length} new expressions. (${skipped} duplicates skipped)` });
    } catch (e) {
      setStatus({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleClearPool = () => {
    if (!window.confirm(`Clear all ${extraPool.length} AI-generated expressions? This cannot be undone.`)) return;
    storage.set("extraPool", []);
    setExtraPool([]);
    setStatus({ ok: "Extra pool cleared." });
  };

  const removeFromPool = (id) => {
    const item = extraPool.find((e) => e.id === id);
    if (!window.confirm(`Remove "${item?.expression}"?`)) return;
    const next = extraPool.filter((e) => e.id !== id);
    storage.set("extraPool", next);
    setExtraPool(next);
  };

  const prov = PROVIDERS.find((p) => p.id === provider);

  return (
    <div className="engexpr-settings">
      <div className="engexpr-settings-section">
        <div className="engexpr-settings-label">Expression Pool</div>
        <div className="engexpr-pool-stat">
          <span>Base expressions</span><strong>{EXPRESSIONS.length}</strong>
        </div>
        <div className="engexpr-pool-stat">
          <span>AI-generated extras</span><strong>{extraPool.length}</strong>
        </div>
        <div className="engexpr-pool-stat">
          <span>Total pool</span><strong>{totalPool.length}</strong>
        </div>
        {extraPool.length > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="engexpr-settings-clear" onClick={() => setShowPool((v) => !v)}>
              {showPool ? "Hide pool ▲" : "View pool ▼"}
            </button>
            <button className="engexpr-settings-clear" onClick={handleClearPool}>
              Clear all
            </button>
          </div>
        )}
        {showPool && extraPool.length > 0 && (
          <div className="engexpr-pool-list">
            {extraPool.map((item) => (
              <div key={item.id} className="engexpr-pool-item">
                <TypeBadge type={item.type} />
                <span className="engexpr-pool-item-expr">{item.expression}</span>
                <button
                  className="engexpr-popup-remove"
                  title="Remove"
                  onClick={() => removeFromPool(item.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="engexpr-settings-divider" />

      <div className="engexpr-settings-section">
        <div className="engexpr-settings-label">AI Provider</div>
        <div className="engexpr-settings-row">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              className={`engexpr-provider-btn${provider === p.id ? " active" : ""}`}
              onClick={() => saveProvider(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="engexpr-settings-section">
        <div className="engexpr-settings-label">API Key</div>
        <input
          className="engexpr-settings-input"
          type="password"
          placeholder={prov?.placeholder ?? ""}
          value={apiKey}
          onChange={(e) => saveKey(e.target.value)}
        />
      </div>

      <div className="engexpr-settings-section">
        <div className="engexpr-settings-label">Model</div>
        <input
          className="engexpr-settings-input"
          type="text"
          placeholder={prov?.defaultModel ?? ""}
          value={model}
          onChange={(e) => saveModel(e.target.value)}
        />
      </div>

      <button
        className="engexpr-settings-generate"
        onClick={handleGenerate}
        disabled={busy}
      >
        {busy ? "Generating…" : "Generate 30 expressions"}
      </button>

      {status && (
        <div className={`engexpr-settings-status ${status.error ? "error" : "ok"}`}>
          {status.error ?? status.ok}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function EngExprPlugin({ storage }) {
  const [extraPool, setExtraPool] = useState(() => storage.get("extraPool", []));
  const [familiar, setFamiliar] = useState(() => storage.get("familiar", []));
  const [bookmarks, setBookmarks] = useState(() => storage.get("bookmarks", []));

  const pool = getAllExpressions(extraPool);

  const [slots, setSlots] = useState(() =>
    initSlots(storage.get("familiar", []), getAllExpressions(storage.get("extraPool", [])))
  );
  const [popup, setPopup] = useState(null);

  // Settings 변경 후 extraPool 재동기화
  const syncExtraPool = useCallback(() => {
    const next = storage.get("extraPool", []);
    setExtraPool(next);
  }, [storage]);

  const saveFamiliar = (next) => { setFamiliar(next); storage.set("familiar", next); };
  const saveBookmarks = (next) => { setBookmarks(next); storage.set("bookmarks", next); };

  const refreshSlot = useCallback(
    (index) => {
      const currentPool = getAllExpressions(storage.get("extraPool", []));
      setSlots((prev) => {
        const usedIds = prev.filter((_, i) => i !== index).map((e) => e?.id).filter(Boolean);
        const next = [...prev];
        next[index] = pickRandom(currentPool, [...familiar, ...usedIds]);
        return next;
      });
    },
    [familiar, storage]
  );

  const shuffleAll = () => {
    const currentPool = getAllExpressions(storage.get("extraPool", []));
    setExtraPool(storage.get("extraPool", []));
    setSlots(initSlots(familiar, currentPool));
  };

  const markGotIt = (index) => {
    const item = slots[index];
    if (!item) return;
    const nextFamiliar = [...familiar, item.id];
    saveFamiliar(nextFamiliar);
    if (bookmarks.includes(item.id)) saveBookmarks(bookmarks.filter((b) => b !== item.id));
    const currentPool = getAllExpressions(storage.get("extraPool", []));
    setSlots((prev) => {
      const usedIds = prev.filter((_, i) => i !== index).map((e) => e?.id).filter(Boolean);
      const next = [...prev];
      next[index] = pickRandom(currentPool, [...nextFamiliar, ...usedIds]);
      return next;
    });
  };

  const toggleBookmark = (item) => {
    const next = bookmarks.includes(item.id)
      ? bookmarks.filter((b) => b !== item.id)
      : [...bookmarks, item.id];
    saveBookmarks(next);
  };

  const allLearned = pool.filter((e) => !familiar.includes(e.id)).length === 0;

  return (
    <div className="engexpr-root">
      {popup === "familiar" && (
        <Popup
          title="★ Familiar"
          items={pool.filter((e) => familiar.includes(e.id))}
          emptyMsg="No familiar expressions yet."
          removeTitle="Remove from familiar"
          onRemove={(id) => saveFamiliar(familiar.filter((f) => f !== id))}
          onClose={() => setPopup(null)}
        />
      )}
      {popup === "bookmarks" && (
        <Popup
          title="🔖 Bookmarks"
          items={pool.filter((e) => bookmarks.includes(e.id))}
          emptyMsg="No bookmarks yet."
          removeTitle="Remove bookmark"
          onRemove={(id) => saveBookmarks(bookmarks.filter((b) => b !== id))}
          onClose={() => setPopup(null)}
        />
      )}

      <div className="engexpr-toolbar">
        <button className="engexpr-btn-shuffle" onClick={shuffleAll}>⟳ Shuffle All</button>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="engexpr-btn-bookmarks" onClick={() => setPopup("bookmarks")}>
            🔖 Bookmarks<span className="count">{bookmarks.length}</span>
          </button>
          <button className="engexpr-btn-familiar" onClick={() => setPopup("familiar")}>
            ★ Familiar<span className="count">{familiar.length}</span>
          </button>
        </div>
      </div>

      {allLearned ? (
        <div className="engexpr-empty">
          <span className="emoji">🎉</span>
          <span>You've learned them all!</span>
          <span style={{ fontSize: 11, color: "#4b5563" }}>
            Remove some from Familiar to keep practicing.
          </span>
        </div>
      ) : (
        <div className="engexpr-list">
          {slots.map((item, i) =>
            item ? (
              <ExprCard
                key={item.id + "-" + i}
                item={item}
                bookmarked={bookmarks.includes(item.id)}
                onRefresh={() => refreshSlot(i)}
                onBookmark={() => toggleBookmark(item)}
                onGotIt={() => markGotIt(i)}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

EngExprPlugin.Settings = Settings;
export default EngExprPlugin;
