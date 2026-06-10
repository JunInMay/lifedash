import { useState } from "react";

function NotesPlugin({ storage }) {
  const [text, setText] = useState(() => storage.get("text", ""));

  const handleChange = (e) => {
    setText(e.target.value);
    storage.set("text", e.target.value);
  };

  return (
    <textarea
      value={text}
      onChange={handleChange}
      placeholder="메모를 입력하세요..."
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        resize: "none",
        padding: 12,
        background: "transparent",
        color: "#e6e6e6",
        font: "inherit",
        lineHeight: 1.5,
      }}
    />
  );
}

export default NotesPlugin;
