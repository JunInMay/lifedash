import { useState, useEffect, useCallback, useRef } from "react";
import { generateBoard, moveRobot } from "./board";
import "./style.css";

const COLOR_NAMES = { red: "빨강", green: "초록", blue: "파랑", yellow: "노랑" };
const SIZE_OPTIONS = [8, 12, 16, 20, 24];
const DIFFICULTY_OPTIONS = [
  { id: "veryEasy", label: "매우 쉬움" },
  { id: "easy", label: "쉬움" },
  { id: "normal", label: "보통" },
  { id: "hard", label: "어려움" },
  { id: "veryHard", label: "매우 어려움" },
];
const DEFAULT_SETTINGS = { size: 12, diagonalWalls: false, difficulty: "normal", cutLimit: false, showOptimal: true };

const readSettings = (storage) => ({ ...DEFAULT_SETTINGS, ...storage.get("settings", {}) });

const DIR_KEYS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// 최단 이동 수(optimal)에 이 값을 더한 것이 "성공"으로 인정되는 최대 이동 수(컷)
const CUT_BUFFER = 2;

const WALL_HEX = {
  red: "#e74c3c",
  green: "#2ecc71",
  blue: "#3498db",
  yellow: "#f1c40f",
};

const DIAGONAL_GRADIENT = {
  slash: (hex) =>
    `linear-gradient(to bottom right, transparent 46%, ${hex} 46%, ${hex} 54%, transparent 54%)`,
  back: (hex) =>
    `linear-gradient(to top right, transparent 46%, ${hex} 46%, ${hex} 54%, transparent 54%)`,
};

function useTimer(active) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    if (startRef.current == null) startRef.current = performance.now() - elapsed * 1000;
    const tick = () => {
      setElapsed((performance.now() - startRef.current) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    setElapsed(0);
  }, []);

  const fmt = `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${(elapsed % 60).toFixed(1).padStart(4, "0")}`;

  return { elapsed, fmt, reset };
}

export default function RicochetRobots({ instanceId, storage, bus }) {
  const [settings, setSettings] = useState(() => readSettings(storage));
  const [board, setBoard] = useState(() => generateBoard(settings));
  const [initialRobots, setInitialRobots] = useState(() => board.robots.map((r) => ({ ...r })));
  const [selected, setSelected] = useState(null);
  const [moves, setMoves] = useState(0);
  const [result, setResult] = useState(null);
  // 첫 이동 후부터 타이머 시작, 결과 나오면 멈춤
  const [timerActive, setTimerActive] = useState(true);
  const { fmt: timerFmt, reset: resetTimer } = useTimer(timerActive && !result);

  const newGame = useCallback((opts) => {
    const next = generateBoard(opts);
    setBoard(next);
    setInitialRobots(next.robots.map((r) => ({ ...r })));
    setSelected(null);
    setMoves(0);
    setResult(null);
    resetTimer();
    setTimerActive(true);
  }, [resetTimer]);

  const refresh = useCallback(() => {
    setBoard((b) => ({ ...b, robots: initialRobots.map((r) => ({ ...r })) }));
    setSelected(null);
    setMoves(0);
    setResult(null);
    // 타이머는 유지 — 같은 맵에서 재도전해도 시간은 계속 흐름
  }, [initialRobots]);

  useEffect(() => {
    return bus.on("plugin:settings-changed", (payload) => {
      if (payload?.instanceId !== instanceId) return;
      const next = readSettings(storage);
      setSettings(next);
      newGame(next);
    });
  }, [bus, instanceId, storage, newGame]);

  const move = useCallback(
    (dirKey) => {
      if (selected == null || result) return;
      const robot = board.robots[selected];
      const { x, y, path } = moveRobot(board, selected, dirKey);
      if (x === robot.x && y === robot.y) return;

      const newMoves = moves + 1;
      const { optimalMoves } = board;
      const cutMoves = settings.cutLimit && optimalMoves != null ? optimalMoves + CUT_BUFFER : null;

      setMoves(newMoves);

      let i = 0;
      const advance = () => {
        const pos = path[i];
        setBoard((b) => ({
          ...b,
          robots: b.robots.map((r, ri) =>
            ri === selected ? { ...r, x: pos.x, y: pos.y } : r
          ),
        }));
        i++;
        if (i < path.length) {
          setTimeout(advance, 120);
        } else if (
          robot.color === board.target.color &&
          x === board.target.x &&
          y === board.target.y
        ) {
          setResult(cutMoves != null && newMoves > cutMoves ? "fail" : "success");
        } else if (cutMoves != null && newMoves >= cutMoves) {
          setResult("fail");
        }
      };
      advance();
    },
    [selected, result, board, moves, settings.cutLimit]
  );

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => newGame(settings), 1400);
    return () => clearTimeout(t);
  }, [result, newGame, settings]);

  const handleKeyDown = (e) => {
    const dir = DIR_KEYS[e.key];
    if (dir) {
      e.preventDefault();
      move(dir);
    }
  };

  const { size, walls, blocked, diagonals, robots, target, optimalMoves } = board;
  const cutMoves = settings.cutLimit && optimalMoves != null ? optimalMoves + CUT_BUFFER : null;
  const wallColor = (on) => (on ? "#8ab4f8" : "#2b2f38");
  const wallWidth = (on) => (on ? 2 : 1);
  const cellPct = 100 / size;

  return (
    <div className="rr-root" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="rr-header">
        <span className="rr-moves">
          이동: {moves}
          {cutMoves != null && ` / 컷 ${cutMoves}`}
          {settings.showOptimal && optimalMoves != null && ` (최단 ${optimalMoves})`}
        </span>
        <span className="rr-timer">{timerFmt}</span>
        <span className="rr-target">
          목표 <span className={`rr-dot rr-${target.color}`} />{" "}
          {COLOR_NAMES[target.color]}
        </span>
        <button className="rr-new" onClick={refresh}>
          새로고침
        </button>
        <button className="rr-new" onClick={() => newGame(settings)}>
          새 게임
        </button>
      </div>

      <div className="rr-board-wrap">
        <div
          className="rr-board"
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
          }}
        >
          {Array.from({ length: size * size }).map((_, i) => {
            const x = i % size;
            const y = Math.floor(i / size);
            const w = walls[y][x];
            const diag = diagonals[y][x];
            const isBlocked = blocked[y][x];
            return (
              <div
                key={i}
                className={`rr-cell ${isBlocked ? "rr-cell-blocked" : ""}`}
                style={
                  isBlocked
                    ? { gridColumn: x + 1, gridRow: y + 1 }
                    : {
                        gridColumn: x + 1,
                        gridRow: y + 1,
                        borderTopWidth: wallWidth(w.N),
                        borderTopColor: wallColor(w.N),
                        borderRightWidth: wallWidth(w.E),
                        borderRightColor: wallColor(w.E),
                        borderBottomWidth: wallWidth(w.S),
                        borderBottomColor: wallColor(w.S),
                        borderLeftWidth: wallWidth(w.W),
                        borderLeftColor: wallColor(w.W),
                        backgroundImage: diag
                          ? DIAGONAL_GRADIENT[diag.shape](WALL_HEX[diag.color])
                          : undefined,
                      }
                }
              />
            );
          })}
          <div
            className="rr-target-wrap"
            style={{
              left: `${target.x * cellPct}%`,
              top: `${target.y * cellPct}%`,
              width: `${cellPct}%`,
              height: `${cellPct}%`,
            }}
          >
            <div className={`rr-target-mark rr-${target.color}`} />
          </div>
          {robots.map((r, i) => (
            <div
              key={r.id}
              className="rr-robot-wrap"
              style={{
                left: `${r.x * cellPct}%`,
                top: `${r.y * cellPct}%`,
                width: `${cellPct}%`,
                height: `${cellPct}%`,
              }}
            >
              <div
                className={`rr-robot rr-${r.color} ${selected === i ? "rr-selected" : ""}`}
                onClick={() => setSelected(selected === i ? null : i)}
              />
            </div>
          ))}
          {result === "success" && (
            <div className="rr-cleared rr-success">
              {moves === optimalMoves ? "완벽해요! 🤯🏆" : "성공! 🎉"}
            </div>
          )}
          {result === "fail" && <div className="rr-cleared rr-fail">실패... 😵</div>}
        </div>
      </div>
    </div>
  );
}

export function Settings({ instanceId, storage, bus }) {
  const [settings, setSettings] = useState(() => readSettings(storage));
  const settingsRef = useRef(settings);

  const update = (patch) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    storage.set("settings", next);
  };

  // 설정창이 닫힐 때(언마운트) 한 번만 게임 초기화
  useEffect(() => {
    return () => bus.emit("plugin:settings-changed", { instanceId });
  }, []);

  return (
    <div className="rr-settings-popup">
      <label>
        판 크기
        <select
          value={settings.size}
          onChange={(e) => update({ size: Number(e.target.value) })}
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} x {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        난이도
        <select
          value={settings.difficulty}
          onChange={(e) => update({ difficulty: e.target.value })}
        >
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <label className="rr-checkbox">
        대각선 벽
        <input
          type="checkbox"
          checked={settings.diagonalWalls}
          onChange={(e) => update({ diagonalWalls: e.target.checked })}
        />
      </label>
      <label className="rr-checkbox">
        컷 제한
        <input
          type="checkbox"
          checked={settings.cutLimit}
          onChange={(e) => update({ cutLimit: e.target.checked })}
        />
      </label>
      <label className="rr-checkbox">
        최단 이동 수 표시
        <input
          type="checkbox"
          checked={settings.showOptimal}
          onChange={(e) => update({ showOptimal: e.target.checked })}
        />
      </label>
      <p className="rr-settings-note">설정창을 닫으면 새 게임이 시작됩니다.</p>
    </div>
  );
}

RicochetRobots.Settings = Settings;
