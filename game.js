// Bottle Pour - a liquid sorting puzzle.

const DEFAULT_CAPACITY = 4;

// Each level: how many colours, how many extra empty bottles, and bottle size.
// Add or edit entries to make the game harder. The last entry repeats forever.
const LEVELS = [
  { colours: 3, empty: 1, capacity: DEFAULT_CAPACITY },
  { colours: 4, empty: 2, capacity: DEFAULT_CAPACITY },
  { colours: 5, empty: 2, capacity: DEFAULT_CAPACITY },
  { colours: 6, empty: 2, capacity: DEFAULT_CAPACITY },
  { colours: 7, empty: 2, capacity: 5 },
];

const PALETTE = [
  "#e74c3c", // red
  "#3498db", // blue
  "#2ecc71", // green
  "#f1c40f", // yellow
  "#9b59b6", // purple
  "#e67e22", // orange
  "#1abc9c", // teal
  "#ff6fb5", // pink
  "#8d6e63", // brown
  "#bdc3c7", // grey
];

const SOLVER_NODE_LIMIT = 50000;
const MAX_GENERATE_ATTEMPTS = 50;

// ---------- game state ----------

let levelIndex = 0;
let capacity = DEFAULT_CAPACITY;
let startBottles = [];   // the puzzle as dealt, for Restart
let bottles = [];        // current state: array of arrays, bottom -> top
let history = [];        // previous states, for Undo
let moves = 0;
let selected = null;

// ---------- rules ----------

function topColour(bottle) {
  return bottle[bottle.length - 1];
}

// Number of same-coloured layers at the top of a bottle.
function topRun(bottle) {
  let run = 0;
  for (let i = bottle.length - 1; i >= 0 && bottle[i] === topColour(bottle); i--) run++;
  return run;
}

function canPour(state, from, to, cap) {
  if (from === to) return false;
  const src = state[from];
  const dst = state[to];
  if (src.length === 0) return false;
  if (dst.length >= cap) return false;
  return dst.length === 0 || topColour(dst) === topColour(src);
}

// Pour the run of matching top layers, as many as fit. Mutates state.
function pour(state, from, to, cap) {
  const src = state[from];
  const dst = state[to];
  const amount = Math.min(topRun(src), cap - dst.length);
  for (let i = 0; i < amount; i++) dst.push(src.pop());
}

// Won when every bottle is either empty or full of a single colour.
function isWon(state, cap) {
  return state.every(b => b.length === 0 || (b.length === cap && b.every(c => c === b[0])));
}

// ---------- solver & generation ----------

function stateKey(state) {
  return state.map(b => b.join(",")).join("|");
}

function cloneState(state) {
  return state.map(b => b.slice());
}

// Depth-first search. Returns true if solvable, false if not,
// or null if the node limit was hit before an answer was found.
function isSolvable(state, cap) {
  const seen = new Set([stateKey(state)]);
  const stack = [state];
  while (stack.length > 0) {
    const current = stack.pop();
    if (isWon(current, cap)) return true;
    for (let from = 0; from < current.length; from++) {
      for (let to = 0; to < current.length; to++) {
        if (!canPour(current, from, to, cap)) continue;
        const next = cloneState(current);
        pour(next, from, to, cap);
        const key = stateKey(next);
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > SOLVER_NODE_LIMIT) return null;
        stack.push(next);
      }
    }
  }
  return false;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generatePuzzle(level) {
  const cap = level.capacity;
  let fallback = null;
  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
    const pool = [];
    for (let c = 0; c < level.colours; c++) {
      for (let i = 0; i < cap; i++) pool.push(c);
    }
    shuffle(pool);

    const state = [];
    for (let b = 0; b < level.colours; b++) state.push(pool.slice(b * cap, (b + 1) * cap));
    for (let e = 0; e < level.empty; e++) state.push([]);

    if (isWon(state, cap)) continue;
    const result = isSolvable(state, cap);
    if (result === true) return state;
    // Too big to check fully - keep it in case nothing better turns up.
    if (result === null && !fallback) fallback = state;
  }
  return fallback;
}

// ---------- UI ----------

const boardEl = document.getElementById("board");
const levelEl = document.getElementById("level");
const movesEl = document.getElementById("moves");
const undoBtn = document.getElementById("undo");
const winEl = document.getElementById("win");
const winText = document.getElementById("win-text");

function currentLevel() {
  return LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
}

function startLevel() {
  const level = currentLevel();
  capacity = level.capacity;
  startBottles = generatePuzzle(level);
  if (!startBottles) {
    alert("Could not generate a solvable puzzle for this level - check the LEVELS settings.");
    return;
  }
  resetToStart();
}

function resetToStart() {
  bottles = cloneState(startBottles);
  history = [];
  moves = 0;
  selected = null;
  winEl.hidden = true;
  render();
}

function render() {
  levelEl.textContent = levelIndex + 1;
  movesEl.textContent = moves;
  undoBtn.disabled = history.length === 0;

  boardEl.innerHTML = "";
  bottles.forEach((bottle, i) => {
    const el = document.createElement("div");
    el.className = "bottle" + (selected === i ? " selected" : "");
    // Height scales with capacity, plus a little headroom for the neck.
    el.style.height = `calc(var(--layer-h) * ${capacity} + 16px)`;
    bottle.forEach(colour => {
      const layer = document.createElement("div");
      layer.className = "layer";
      layer.style.background = PALETTE[colour % PALETTE.length];
      el.appendChild(layer);
    });
    el.addEventListener("click", () => onBottleClick(i));
    boardEl.appendChild(el);
  });
}

function shake(index) {
  const el = boardEl.children[index];
  el.classList.remove("shake");
  void el.offsetWidth; // restart the animation
  el.classList.add("shake");
}

function onBottleClick(i) {
  if (selected === null) {
    if (bottles[i].length === 0) {
      shake(i);
      return;
    }
    selected = i;
    render();
    return;
  }

  if (selected === i) {
    selected = null;
    render();
    return;
  }

  const from = selected;
  selected = null;
  if (!canPour(bottles, from, i, capacity)) {
    render();
    shake(i);
    return;
  }

  history.push(cloneState(bottles));
  pour(bottles, from, i, capacity);
  moves++;
  render();

  if (isWon(bottles, capacity)) {
    winText.textContent = `Solved in ${moves} move${moves === 1 ? "" : "s"}.`;
    winEl.hidden = false;
  }
}

undoBtn.addEventListener("click", () => {
  if (history.length === 0) return;
  bottles = history.pop();
  moves--;
  selected = null;
  render();
});

document.getElementById("restart").addEventListener("click", resetToStart);
document.getElementById("new").addEventListener("click", startLevel);
document.getElementById("next").addEventListener("click", () => {
  levelIndex++;
  startLevel();
});

startLevel();
