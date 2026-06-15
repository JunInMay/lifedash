import { useState, useEffect, useCallback } from "react";
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
const DEFAULT_SETTINGS = { size: 12, diagonalWalls: false, difficulty: "normal" };

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

// "to top right"는 "\" 모양, "to bottom right"는 "/" 모양 줄무늬를 그린다 (perpendicular to 그라디언트 방향)
const DIAGONAL_GRADIENT = {
  slash: (hex) =>
    `linear-gradient(to bottom right, transparent 46%, ${hex} 46%, ${hex} 54%, transparent 54%)`,
  back: (hex) =>
    `linear-gradient(to top right, transparent 46%, ${hex} 46%, ${hex} 54%, transparent 54%)`,
};

export default function RicochetRobots({ instanceId, storage, bus }) {
  const [settings, setSettings] = useState(() => readSettings(storage));
  const [board, setBoard] = useState(() => generateBoard(settings));
  const [initialRobots, setInitialRobots] = useState(() => board.robots.map((r) => ({ ...r })));
  const [selected, setSelected] = useState(null);
  const [moves, setMoves] = useState(0);
  // null | "success" | "fail"
  const [result, setResult] = useState(null);

  const newGame = useCallback((opts) => {
    const next = generateBoard(opts);
    setBoard(next);
    setInitialRobots(next.robots.map((r) => ({ ...r })));
    setSelected(null);
    setMoves(0);
    setResult(null);
  }, []);

  // 현재 보드(벽/목표/디플렉터)는 유지하고 로봇 위치만 초기 상태로 되돌림
  const refresh = useCallback(() => {
    setBoard((b) => ({ ...b, robots: initialRobots.map((r) => ({ ...r })) }));
    setSelected(null);
    setMoves(0);
    setResult(null);
  }, [initialRobots]);

  // 설정 팝업(공통 ⚙ 버튼)에서 변경한 설정을 반영
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
      const cutMoves = optimalMoves != null ? optimalMoves + CUT_BUFFER : null;
      setMoves(newMoves);

      // 디플렉터로 꺾이는 지점마다 멈춰가며 애니메이션(rr-robot-wrap의 transition과 동일한 간격)
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
          // 목표에 도달했어도 컷(최단+여유)을 넘겼으면 실패
          setResult(cutMoves != null && newMoves > cutMoves ? "fail" : "success");
        } else if (cutMoves != null && newMoves >= cutMoves) {
          setResult("fail");
        }
      };
      advance();
    },
    [selected, result, board, moves]
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
  const cutMoves = optimalMoves != null ? optimalMoves + CUT_BUFFER : null;
  const wallColor = (on) => (on ? "#8ab4f8" : "#2b2f38");
  const wallWidth = (on) => (on ? 2 : 1);
  const cellPct = 100 / size;

  return (
    <div className="rr-root" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="rr-header">
        <span className="rr-moves">
          이동: {moves}
          {cutMoves != null && ` / 컷 ${cutMoves} (최단 ${optimalMoves})`}
        </span>
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

// 카드 헤더의 공통 ⚙ 버튼으로 열리는 설정 팝업
export function Settings({ instanceId, storage, bus }) {
  const [settings, setSettings] = useState(() => readSettings(storage));

  const update = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    storage.set("settings", next);
    bus.emit("plugin:settings-changed", { instanceId });
  };

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
    </div>
  );
}

RicochetRobots.Settings = Settings;
