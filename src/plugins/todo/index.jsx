import { useState } from "react";

function TodoPlugin({ storage }) {
  const [items, setItems] = useState(() => storage.get("items", []));
  const [input, setInput] = useState("");

  const update = (next) => {
    setItems(next);
    storage.set("items", next);
  };

  const add = () => {
    const text = input.trim();
    if (!text) return;
    update([...items, { id: crypto.randomUUID(), text, done: false }]);
    setInput("");
  };

  const toggle = (id) => {
    update(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  };

  const remove = (id) => {
    update(items.filter((it) => it.id !== id));
  };

  return (
    <div className="widget-pad" style={{ gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="widget-input"
          value={input}
          placeholder="할 일 입력 후 Enter"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="widget-btn" onClick={add}>추가</button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, overflowY: "auto", flex: 1 }}>
        {items.map((it) => (
          <li
            key={it.id}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" }}
          >
            <input type="checkbox" checked={it.done} onChange={() => toggle(it.id)} />
            <span
              style={{
                flex: 1,
                textDecoration: it.done ? "line-through" : "none",
                color: it.done ? "#6b7280" : "inherit",
                wordBreak: "break-all",
              }}
            >
              {it.text}
            </span>
            <button className="plugin-close" onClick={() => remove(it.id)}>✕</button>
          </li>
        ))}
        {items.length === 0 && (
          <li style={{ color: "#5b6270", padding: "8px 2px" }}>할 일이 없습니다</li>
        )}
      </ul>
    </div>
  );
}

export default TodoPlugin;
