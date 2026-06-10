import { useState } from "react";
import { LANGS, CLAUDE_MODELS, langName, translate } from "./engines";
import "./translator.css";

function TranslatorPlugin({ storage }) {
  const [engine, setEngine] = useState(() => storage.get("engine", "google"));
  const [apiKey, setApiKey] = useState(() => storage.get("apiKey", ""));
  const [model, setModel] = useState(() => storage.get("model", "claude-haiku-4-5"));
  const [src, setSrc] = useState(() => storage.get("src", "auto"));
  const [tgt, setTgt] = useState(() => storage.get("tgt", "ko"));
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [detected, setDetected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const persist = (key, setter) => (value) => {
    setter(value);
    storage.set(key, value);
  };
  const setEngineP = persist("engine", setEngine);
  const setApiKeyP = persist("apiKey", setApiKey);
  const setModelP = persist("model", setModel);
  const setSrcP = persist("src", setSrc);
  const setTgtP = persist("tgt", setTgt);

  const run = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await translate({ engine, text, src, tgt, apiKey, model });
      setResult(r.text);
      setDetected(r.detected);
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const swap = () => {
    const effectiveSrc = src === "auto" ? (detected ?? "en") : src;
    setSrcP(tgt);
    setTgtP(effectiveSrc);
    if (result) {
      setInput(result);
      setResult("");
    }
  };

  return (
    <div className="trs-root">
      <div className="trs-row">
        <select className="trs-select" value={src} onChange={(e) => setSrcP(e.target.value)}>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
        <button className="trs-swap" title="언어 교체" onClick={swap}>⇄</button>
        <select className="trs-select" value={tgt} onChange={(e) => setTgtP(e.target.value)}>
          {LANGS.filter((l) => l.code !== "auto").map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
        <div className="trs-spacer" />
        <select className="trs-select" value={engine} onChange={(e) => setEngineP(e.target.value)}>
          <option value="google">무료 (구글)</option>
          <option value="claude">AI (Claude)</option>
        </select>
        {engine === "claude" && (
          <button
            className="widget-btn"
            title="AI 번역 설정"
            onClick={() => setShowSettings((s) => !s)}
          >
            ⚙
          </button>
        )}
      </div>

      {engine === "claude" && showSettings && (
        <div className="trs-settings">
          <input
            className="widget-input"
            type="password"
            value={apiKey}
            placeholder="Claude API 키 (sk-ant-...)"
            onChange={(e) => setApiKeyP(e.target.value)}
          />
          <select className="trs-select" value={model} onChange={(e) => setModelP(e.target.value)}>
            {CLAUDE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <span className="trs-hint">키는 이 PC의 로컬 저장소에만 저장됩니다.</span>
        </div>
      )}

      <textarea
        className="trs-text"
        value={input}
        placeholder="번역할 내용 입력 (Ctrl+Enter로 번역)"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
        }}
      />

      <div className="trs-row">
        <button className="widget-btn" onClick={run} disabled={busy}>
          {busy ? "번역 중..." : "번역"}
        </button>
        {detected && src === "auto" && (
          <span className="trs-hint">감지된 언어: {langName(detected)}</span>
        )}
        {result && (
          <>
            <div className="trs-spacer" />
            <button className="widget-btn" onClick={() => navigator.clipboard.writeText(result)}>
              복사
            </button>
          </>
        )}
      </div>

      {error ? (
        <div className="trs-error">{error}</div>
      ) : (
        <div className={`trs-result ${result ? "" : "placeholder"}`}>
          {result || "번역 결과가 여기에 표시됩니다"}
        </div>
      )}
    </div>
  );
}

export default TranslatorPlugin;
