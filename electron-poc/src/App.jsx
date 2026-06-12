import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const initialCards = [
  {
    id: "notes",
    title: "A: DOM Card",
    kind: "dom",
    x: 72,
    y: 88,
    w: 340,
    h: 230,
    z: 3
  },
  {
    id: "youtube",
    title: "B: YouTube Webview",
    kind: "webview",
    url: "https://www.youtube.com",
    x: 300,
    y: 156,
    w: 470,
    h: 320,
    z: 1
  },
  {
    id: "browser",
    title: "C: Example Webview",
    kind: "webview",
    url: "https://example.com",
    x: 620,
    y: 96,
    w: 390,
    h: 280,
    z: 2
  }
];

function App() {
  const [cards, setCards] = useState(initialCards);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bringToFront = (id) => {
    setCards((items) => {
      const maxZ = Math.max(...items.map((item) => item.z));
      return items.map((item) => (item.id === id ? { ...item, z: maxZ + 1 } : item));
    });
  };

  const moveCard = (id, dx, dy) => {
    setCards((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              x: Math.max(0, item.x + dx),
              y: Math.max(0, item.y + dy)
            }
          : item
      )
    );
  };

  const resizeCard = (id, dw, dh) => {
    setCards((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              w: Math.max(260, item.w + dw),
              h: Math.max(180, item.h + dh)
            }
          : item
      )
    );
  };

  return (
    <main className="app">
      <header className="topbar">
        <strong>Electron Webview Layer PoC</strong>
        <button onClick={() => setDrawerOpen((open) => !open)}>Plugin Drawer</button>
      </header>

      <section className="board">
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            onFocus={() => bringToFront(card.id)}
            onMove={(dx, dy) => moveCard(card.id, dx, dy)}
            onResize={(dw, dh) => resizeCard(card.id, dw, dh)}
          />
        ))}
      </section>

      {drawerOpen && (
        <aside className="drawer">
          <div className="drawer-title">DOM Drawer</div>
          <button>Clock</button>
          <button>Notes</button>
          <button>Browser</button>
          <button>YouTube</button>
        </aside>
      )}
    </main>
  );
}

function Card({ card, onFocus, onMove, onResize }) {
  const [dragStart, setDragStart] = useState(null);
  const [resizeStart, setResizeStart] = useState(null);

  const onPointerMove = (event) => {
    if (dragStart) {
      onMove(event.clientX - dragStart.x, event.clientY - dragStart.y);
      setDragStart({ x: event.clientX, y: event.clientY });
    }
    if (resizeStart) {
      onResize(event.clientX - resizeStart.x, event.clientY - resizeStart.y);
      setResizeStart({ x: event.clientX, y: event.clientY });
    }
  };

  const stopPointerAction = () => {
    setDragStart(null);
    setResizeStart(null);
  };

  return (
    <article
      className="card"
      style={{
        left: card.x,
        top: card.y,
        width: card.w,
        height: card.h,
        zIndex: card.z
      }}
      onPointerMove={onPointerMove}
      onPointerUp={stopPointerAction}
      onPointerCancel={stopPointerAction}
      onPointerDown={onFocus}
    >
      <div
        className="card-title"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragStart({ x: event.clientX, y: event.clientY });
          onFocus();
        }}
      >
        <span>{card.title}</span>
        <small>z:{card.z}</small>
      </div>

      <div className="card-body">
        {card.kind === "webview" ? (
          <webview
            className="embedded-webview"
            src={card.url}
            allowpopups="true"
            webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
          />
        ) : (
          <div className="dom-panel">
            <h2>Overlap Test</h2>
            <p>
              Bring this card over a webview card. The webview should be clipped and covered like
              normal card content.
            </p>
            <div className="sample-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <button
        className="resize"
        aria-label="Resize"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizeStart({ x: event.clientX, y: event.clientY });
          onFocus();
        }}
      />
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
