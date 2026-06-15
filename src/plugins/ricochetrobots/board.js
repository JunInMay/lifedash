const COLORS = ["red", "green", "blue", "yellow"];
const DEFAULT_SIZE = 12;

const DIRS = {
  up: { dx: 0, dy: -1, from: "N" },
  down: { dx: 0, dy: 1, from: "S" },
  left: { dx: -1, dy: 0, from: "W" },
  right: { dx: 1, dy: 0, from: "E" },
};

const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
const NEIGHBOR = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

// 대각선 벽(디플렉터): "/" 는 slash, "\" 는 back. 로봇이 진입하면 90도 방향 전환 후 계속 이동
const DEFLECT = {
  slash: { up: "right", right: "up", down: "left", left: "down" },
  back: { up: "left", left: "up", down: "right", right: "down" },
};

function emptyWalls(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ N: false, E: false, S: false, W: false }))
  );
}

function randCell(size) {
  return { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) };
}

const MAX_SOLVE_DEPTH = 10;
const DEFAULT_SOLVE_NODES = 5000;
const LEGACY_SOLVE_NODES = 1500;
const MAX_GEN_ATTEMPTS = 40;

const DIFFICULTY_CONFIG = {
  veryEasy: {
    minOptimal: 0,
    targetSamples: 1,
    attempts: MAX_GEN_ATTEMPTS,
    wallFactor: 1,
    solveNodes: LEGACY_SOLVE_NODES,
  },
  easy: {
    minOptimal: 4,
    targetSamples: 4,
    attempts: MAX_GEN_ATTEMPTS,
    wallFactor: 1.15,
    solveNodes: DEFAULT_SOLVE_NODES,
  },
  normal: {
    minOptimal: 5,
    targetSamples: 5,
    attempts: 30,
    wallFactor: 1.35,
    solveNodes: DEFAULT_SOLVE_NODES,
  },
  hard: {
    minOptimal: 6,
    targetSamples: 6,
    attempts: 24,
    wallFactor: 1.6,
    solveNodes: DEFAULT_SOLVE_NODES,
  },
  veryHard: {
    minOptimal: 7,
    targetSamples: 8,
    attempts: 20,
    wallFactor: 1.9,
    solveNodes: DEFAULT_SOLVE_NODES,
  },
};

function encodeState(positions) {
  return positions.map((p) => `${p.x},${p.y}`).join("|");
}

// 깊이/노드 수 제한 BFS로 "목표색 로봇이 목표 칸에 도달 가능한가"와 "최단 이동 수"를 함께 구한다.
// 노드 수 한도는 "해가 없음"을 증명하느라 탐색이 폭발하는 것을 막기 위한 안전장치 —
// 한도 도달 시 그냥 "이번 시도는 실패"로 보고 재생성한다
function solveBoard(board, maxDepth = MAX_SOLVE_DEPTH, maxNodes = DEFAULT_SOLVE_NODES) {
  const { robots, target } = board;
  const targetIdx = robots.findIndex((r) => r.color === target.color);
  const start = robots.map((r) => ({ x: r.x, y: r.y }));
  if (start[targetIdx].x === target.x && start[targetIdx].y === target.y) {
    return { solvable: true, optimal: 0 };
  }

  let frontier = [start];
  const visited = new Set([encodeState(start)]);

  for (let depth = 0; depth < maxDepth; depth++) {
    const next = [];
    for (const positions of frontier) {
      const tempRobots = robots.map((r, i) => ({ ...r, x: positions[i].x, y: positions[i].y }));
      const tempBoard = { ...board, robots: tempRobots };
      for (let i = 0; i < tempRobots.length; i++) {
        for (const dirKey of Object.keys(DIRS)) {
          const res = moveRobot(tempBoard, i, dirKey);
          if (res.x === positions[i].x && res.y === positions[i].y) continue;
          if (i === targetIdx && res.x === target.x && res.y === target.y) {
            return { solvable: true, optimal: depth + 1 };
          }
          const newPositions = positions.map((p, idx) =>
            idx === i ? { x: res.x, y: res.y } : p
          );
          const key = encodeState(newPositions);
          if (!visited.has(key)) {
            if (visited.size >= maxNodes) return { solvable: false, optimal: null };
            visited.add(key);
            next.push(newPositions);
          }
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return { solvable: false, optimal: null };
}

// optimalMoves: BFS로 구한 최단 이동 수. 풀이를 못 찾으면 null(드묾 — 이 경우 UI에서 컷 없이 진행)
export function generateBoard(options = {}) {
  const difficulty = DIFFICULTY_CONFIG[options.difficulty] ?? DIFFICULTY_CONFIG.normal;
  let best = null;

  for (let attempt = 0; attempt < difficulty.attempts; attempt++) {
    const board = buildBoard(options);
    const targetSamples = buildTargetSamples(board, difficulty.targetSamples);
    for (const target of targetSamples) {
      const candidateBoard = { ...board, target };
      const { solvable, optimal } = solveBoard(candidateBoard, MAX_SOLVE_DEPTH, difficulty.solveNodes);
      if (!solvable) continue;
      const candidate = { ...candidateBoard, optimalMoves: optimal };
      if (optimal >= difficulty.minOptimal) return candidate;
      if (!best || optimal > best.optimalMoves) best = candidate;
    }
  }
  return best ?? { ...buildBoard(options), optimalMoves: null };
}

function buildTargetSamples(board, count) {
  const samples = [{ ...board.target }];
  for (let i = 1; i < count; i++) {
    samples.push(randTarget(board));
  }
  return samples;
}

function randTarget(board) {
  const { size, blocked, diagonals, robots } = board;
  let cell;
  do {
    cell = randCell(size);
  } while (
    blocked[cell.y][cell.x] ||
    diagonals[cell.y][cell.x] ||
    robots.some((r) => r.x === cell.x && r.y === cell.y)
  );
  return { ...cell, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
}

function buildBoard(options = {}) {
  const { size = DEFAULT_SIZE, diagonalWalls = false } = options;
  const difficulty = DIFFICULTY_CONFIG[options.difficulty] ?? DIFFICULTY_CONFIG.normal;
  const wallCount = Math.round(size * size * 0.15 * difficulty.wallFactor);
  const diagonalCount = diagonalWalls ? Math.round(size * size * 0.04) : 0;

  const walls = emptyWalls(size);

  for (let i = 0; i < wallCount; i++) {
    const { x, y } = randCell(size);
    const side = ["N", "E", "S", "W"][Math.floor(Math.random() * 4)];
    const n = NEIGHBOR[side];
    const nx = x + n.dx;
    const ny = y + n.dy;
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
    walls[y][x][side] = true;
    walls[ny][nx][OPPOSITE[side]] = true;
  }

  // 중앙 정사각형 벽 — 로봇/타겟/디플렉터가 들어가지 못하는 막힌 블록, 슬라이드의 기준점이 되어 난이도를 낮춤
  // 보드가 작으면(8x8) 생략, 중간 크기(10~16)는 2x2, 큰 보드(20+)는 4x4
  const occupied = new Set();
  const blocked = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const CENTER_SIZE = size < 10 ? 0 : size < 20 ? 2 : 4;
  const centerX = Math.floor((size - CENTER_SIZE) / 2);
  const centerY = Math.floor((size - CENTER_SIZE) / 2);
  for (let y = centerY; y < centerY + CENTER_SIZE; y++) {
    for (let x = centerX; x < centerX + CENTER_SIZE; x++) {
      occupied.add(`${x},${y}`);
      blocked[y][x] = true;
      for (const side of ["N", "E", "S", "W"]) {
        const n = NEIGHBOR[side];
        const nx = x + n.dx;
        const ny = y + n.dy;
        const inBlock =
          nx >= centerX && nx < centerX + CENTER_SIZE && ny >= centerY && ny < centerY + CENTER_SIZE;
        if (inBlock) continue;
        walls[y][x][side] = true;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          walls[ny][nx][OPPOSITE[side]] = true;
        }
      }
    }
  }

  const robots = COLORS.map((color, id) => {
    let cell;
    do {
      cell = randCell(size);
    } while (occupied.has(`${cell.x},${cell.y}`));
    occupied.add(`${cell.x},${cell.y}`);
    return { id, color, x: cell.x, y: cell.y };
  });

  let target;
  do {
    target = randCell(size);
  } while (occupied.has(`${target.x},${target.y}`));
  target.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  occupied.add(`${target.x},${target.y}`);

  const diagonals = Array.from({ length: size }, () => Array.from({ length: size }, () => null));
  for (let i = 0; i < diagonalCount; i++) {
    let cell;
    do {
      cell = randCell(size);
    } while (occupied.has(`${cell.x},${cell.y}`));
    occupied.add(`${cell.x},${cell.y}`);
    diagonals[cell.y][cell.x] = {
      shape: Math.random() < 0.5 ? "slash" : "back",
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  }

  return { size, walls, blocked, diagonals, robots, target };
}

// path: 꺾이는 지점(디플렉터 통과 지점)과 최종 정지 지점을 순서대로 담은 배열 — 애니메이션이 구간별로 거쳐갈 좌표
export function moveRobot(board, robotIndex, dirKey) {
  const { size, walls, diagonals, robots } = board;
  const robotColor = robots[robotIndex].color;
  let dir = DIRS[dirKey];
  let { x, y } = robots[robotIndex];
  const maxSteps = size * size * 4;
  const path = [];

  for (let step = 0; step < maxSteps; step++) {
    if (walls[y][x][dir.from]) break;
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) break;
    if (robots.some((r, i) => i !== robotIndex && r.x === nx && r.y === ny)) break;
    x = nx;
    y = ny;

    // 같은 색 로봇은 디플렉터를 그대로 통과, 다른 색은 90도 꺾여 계속 이동
    const diag = diagonals[y][x];
    if (diag && diag.color !== robotColor) {
      let curDirKey = Object.keys(DIRS).find((k) => DIRS[k] === dir);
      const deflected = DEFLECT[diag.shape][curDirKey];
      if (deflected) {
        path.push({ x, y });
        dir = DIRS[deflected];
      }
    }
  }
  path.push({ x, y });
  return { x, y, path };
}
