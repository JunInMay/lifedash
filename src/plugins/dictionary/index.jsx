import { useState } from "react";
import { MODES, lookup, posLabel } from "./api";
import "./dictionary.css";

const HISTORY_MAX = 30;

function DictionaryPlugin({ storage }) {
  const [mode, setMode] = useState(() => storage.get("mode", "enen"));
  const [history, setHistory] = useState(() => storage.get("history", []));
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const setModeP = (next) => {
    setMode(next);
    storage.set("mode", next);
  };

  const updateHistory = (next) => {
    setHistory(next);
    storage.set("history", next);
  };

  const search = async (word, searchMode) => {
    const w = word.trim().toLowerCase();
    if (!w || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await lookup(w, searchMode);
      setResult(r);
      // 성공한 검색만 기록에 추가 (같은 단어+모드는 맨 앞으로)
      const rest = history.filter((h) => !(h.word === w && h.mode === searchMode));
      updateHistory([{ word: w, mode: searchMode }, ...rest].slice(0, HISTORY_MAX));
    } catch (err) {
      setResult(null);
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const searchFromHistory = (item) => {
    setQuery(item.word);
    setModeP(item.mode);
    search(item.word, item.mode);
  };

  const removeHistory = (e, item) => {
    e.stopPropagation();
    updateHistory(history.filter((h) => !(h.word === item.word && h.mode === item.mode)));
  };

  const playAudio = () => {
    if (result?.audio) new Audio(result.audio).play().catch(() => {});
  };

  return (
    <div className="dic-root">
      <div className="dic-main">
        <div className="dic-search">
          <div className="dic-modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`dic-mode-btn ${m.id === mode ? "active" : ""}`}
                onClick={() => setModeP(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <input
            className="widget-input"
            value={query}
            placeholder="영어 단어 검색 (Enter)"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(query, mode)}
          />
          <button className="widget-btn" onClick={() => search(query, mode)} disabled={busy}>
            {busy ? "..." : "검색"}
          </button>
        </div>

        <div className="dic-body">
          {error && <div className="dic-status error">{error}</div>}
          {!error && !result && (
            <div className="dic-status">
              단어를 검색하세요
              <br />
              우측 기록을 클릭하면 다시 조회됩니다
            </div>
          )}
          {!error && result && (
            <div>
              <div className="dic-word-head">
                <span className="dic-word">{result.word}</span>
                {result.phonetic && <span className="dic-phonetic">{result.phonetic}</span>}
                {result.audio && (
                  <button className="dic-audio" title="발음 듣기" onClick={playAudio}>
                    🔊
                  </button>
                )}
              </div>

              {result.mode === "enko" && result.translation && (
                <div className="dic-translation">{result.translation}</div>
              )}

              {result.meanings.map((m, i) => (
                <div key={i} className="dic-pos-block">
                  <span className="dic-pos">{posLabel(m.pos)}</span>
                  {result.mode === "enen" ? (
                    <>
                      <ol className="dic-def-list">
                        {m.definitions.map((d, j) => (
                          <li key={j}>
                            {d.definition}
                            {d.example && (
                              <div className="dic-example">“{d.example}”</div>
                            )}
                          </li>
                        ))}
                      </ol>
                      {m.synonyms.length > 0 && (
                        <div className="dic-synonyms">유의어: {m.synonyms.join(", ")}</div>
                      )}
                    </>
                  ) : (
                    <div className="dic-terms">{m.terms.join(", ")}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dic-side">
        <div className="dic-side-head">
          <span>검색 기록</span>
          {history.length > 0 && (
            <button className="dic-clear" onClick={() => updateHistory([])}>
              전체 삭제
            </button>
          )}
        </div>
        <div className="dic-side-list">
          {history.length === 0 && <div className="dic-empty">기록이 없습니다</div>}
          {history.map((item) => (
            <button
              key={`${item.mode}:${item.word}`}
              className={`dic-item ${
                result && result.word === item.word && mode === item.mode ? "active" : ""
              }`}
              onClick={() => searchFromHistory(item)}
            >
              <span className="dic-item-word">{item.word}</span>
              <span className="dic-item-mode">
                {MODES.find((m) => m.id === item.mode)?.label}
              </span>
              <span className="plugin-close" onClick={(e) => removeHistory(e, item)}>
                ✕
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DictionaryPlugin;
