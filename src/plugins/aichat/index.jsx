import { useEffect, useRef, useState } from "react";
import { PROVIDERS, DEFAULT_SYSTEM, sendChat } from "./api";
import "./aichat.css";

const HISTORY_MAX = 100; // storage에 보관할 최대 메시지 수

function AiChatPlugin({ storage }) {
  const [provider, setProvider] = useState(() => storage.get("provider", "claude"));
  const [keys, setKeys] = useState(() => storage.get("keys", {}));
  const [models, setModels] = useState(() => storage.get("models", {}));
  const [system, setSystem] = useState(() => storage.get("system", DEFAULT_SYSTEM));
  const [messages, setMessages] = useState(() => storage.get("messages", []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const msgsRef = useRef(null);

  const providerInfo = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const apiKey = keys[provider] ?? "";
  const model = models[provider] ?? providerInfo.defaultModel;

  // 새 메시지가 생기면 맨 아래로 스크롤
  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const updateMessages = (next) => {
    setMessages(next);
    storage.set("messages", next);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text }].slice(-HISTORY_MAX);
    updateMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const reply = await sendChat({ provider, apiKey, model, system, messages: next });
      updateMessages([...next, { role: "assistant", content: reply }].slice(-HISTORY_MAX));
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const clearChat = () => {
    updateMessages([]);
    setError(null);
  };

  return (
    <div className="chat-root">
      <div className="chat-head">
        <select
          className="chat-select"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            storage.set("provider", e.target.value);
          }}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <span className="chat-hint">{model}</span>
        <div className="chat-spacer" />
        <button className="widget-btn" title="대화 비우기" onClick={clearChat}>🗑</button>
        <button className="widget-btn" title="설정" onClick={() => setShowSettings((s) => !s)}>
          ⚙
        </button>
      </div>

      {showSettings && (
        <div className="chat-settings">
          <input
            className="widget-input"
            type="password"
            value={apiKey}
            placeholder={`${providerInfo.label} API 키 (${providerInfo.keyPlaceholder})`}
            onChange={(e) => {
              const next = { ...keys, [provider]: e.target.value };
              setKeys(next);
              storage.set("keys", next);
            }}
          />
          <input
            className="widget-input"
            value={model}
            placeholder="모델 ID"
            onChange={(e) => {
              const next = { ...models, [provider]: e.target.value };
              setModels(next);
              storage.set("models", next);
            }}
          />
          <span className="chat-hint">예: {providerInfo.modelHint}</span>
          <textarea
            value={system}
            onChange={(e) => {
              setSystem(e.target.value);
              storage.set("system", e.target.value);
            }}
          />
          <span className="chat-hint">
            시스템 프롬프트 (대화 상대 성격) · 키는 이 PC의 로컬 저장소에만 저장됩니다
          </span>
        </div>
      )}

      <div className="chat-msgs" ref={msgsRef}>
        {messages.length === 0 && !busy && (
          <div className="chat-empty">
            영어로 인사해보세요 👋
            <br />
            (Enter로 전송)
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="chat-bubble assistant pending">...</div>}
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-input-row">
        <input
          className="widget-input"
          value={input}
          placeholder="Type in English..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="widget-btn" onClick={send} disabled={busy}>
          전송
        </button>
      </div>
    </div>
  );
}

export default AiChatPlugin;
