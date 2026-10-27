// Bottle Pour - a liquid sorting puzzle.
// Rules live in rules.js and the fixed levels in levels.js.

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

// ---------- game state ----------

let playerName = "";
let levelIndex = 0;
let capacity = 4;
let bottles = [];        // current state: array of arrays, bottom -> top
let history = [];        // previous states, for Undo
let moves = 0;
let selected = null;

// ---------- UI ----------

const boardEl = document.getElementById("board");
const levelEl = document.getElementById("level");
const movesEl = document.getElementById("moves");
const undoBtn = document.getElementById("undo");
const winEl = document.getElementById("win");
const winText = document.getElementById("win-text");

const nextBtn = document.getElementById("next");
const playerEl = document.getElementById("player");
const nameDialog = document.getElementById("name-dialog");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");

function currentLevel() {
  return LEVELS[levelIndex];
}

function startLevel() {
  capacity = currentLevel().capacity;
  resetToStart();
}

function resetToStart() {
  bottles = cloneState(currentLevel().bottles);
  history = [];
  moves = 0;
  selected = null;
  winEl.hidden = true;
  render();
}

function render() {
  levelEl.textContent = `${levelIndex + 1} / ${LEVELS.length}`;
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
  if (animating) return;
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

  animating = true;
  animatePour(from, i).then(() => {
    animating = false;
    history.push(cloneState(bottles));
    pour(bottles, from, i, capacity);
    moves++;
    render();

    if (isWon(bottles, capacity)) {
      const par = currentLevel().par;
      const lastLevel = levelIndex === LEVELS.length - 1;
      saveProgress(playerName, (levelIndex + 1) % LEVELS.length);
      winText.textContent =
        `Solved in ${moves} move${moves === 1 ? "" : "s"} (best possible: ${par}).` +
        (lastLevel ? " You've completed every level!" : "");
      nextBtn.textContent = lastLevel ? "Play again" : "Next level";
      winEl.hidden = false;
    }
  });
}

// ---------- pour animation ----------

const MOVE_MS = 350;        // bottle travelling to / from the target
const STREAM_MS = 120;      // stream reaching down / pulling away
const LAYER_MS = 220;       // time to pour each layer
const TILT_DEG = 100;
const POUR_GAP = 40;        // how far above the target's mouth the source pours from

let animating = false;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Plays the pour on the current DOM only; the caller updates the state afterwards.
async function animatePour(from, to) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const srcEl = boardEl.children[from];
  const dstEl = boardEl.children[to];
  const layerH = parseFloat(getComputedStyle(srcEl).getPropertyValue("--layer-h"));
  const amount = Math.min(topRun(bottles[from]), capacity - bottles[to].length);
  const colour = PALETTE[topColour(bottles[from]) % PALETTE.length];

  // Tilt around the mouth and park it just above the target's mouth.
  const half = srcEl.offsetWidth / 2;
  const pourX = dstEl.offsetLeft + half;
  const pourY = dstEl.offsetTop - POUR_GAP;
  const dx = pourX - (srcEl.offsetLeft + half);
  const dy = pourY - srcEl.offsetTop;
  // Lay the body back toward where the bottle came from, unless that side
  // has no room on screen (e.g. a narrow phone), then use the other side.
  const bodyLen = srcEl.offsetHeight;
  const screenX = boardEl.getBoundingClientRect().left + pourX;
  let bodyRight = dstEl.offsetLeft < srcEl.offsetLeft;
  if (bodyRight && screenX + bodyLen > window.innerWidth) bodyRight = false;
  else if (!bodyRight && screenX - bodyLen < 0) bodyRight = true;
  const tilt = bodyRight ? -TILT_DEG : TILT_DEG;

  srcEl.classList.remove("selected");
  srcEl.classList.add("pouring");
  srcEl.style.transition = `transform ${MOVE_MS}ms ease-in-out`;
  srcEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${tilt}deg)`;
  await wait(MOVE_MS);

  // Stream falls from the mouth to the target's liquid surface.
  const surfaceY = dstEl.offsetTop + dstEl.clientHeight - bottles[to].length * layerH;
  const stream = document.createElement("div");
  stream.className = "stream";
  stream.style.background = colour;
  stream.style.left = `${pourX - 5}px`;
  stream.style.top = `${pourY}px`;
  stream.style.height = "0px";
  stream.style.transition = `top ${STREAM_MS}ms linear, height ${STREAM_MS}ms linear`;
  boardEl.appendChild(stream);
  void stream.offsetHeight;
  stream.style.height = `${surfaceY - pourY}px`;
  await wait(STREAM_MS);

  // Drain the source's top layers while new layers rise in the target.
  const fillMs = amount * LAYER_MS;
  const srcLayers = Array.from(srcEl.children).slice(-amount);
  const newLayers = [];
  for (let n = 0; n < amount; n++) {
    const layer = document.createElement("div");
    layer.className = "layer";
    layer.style.background = colour;
    layer.style.height = "0px";
    dstEl.appendChild(layer);
    newLayers.push(layer);
  }
  void dstEl.offsetHeight;
  for (const layer of [...srcLayers, ...newLayers]) {
    layer.style.transition = `height ${fillMs}ms linear`;
  }
  srcLayers.forEach(layer => {
    layer.style.height = "0px";
    layer.style.borderTopWidth = "0px";
  });
  newLayers.forEach(layer => { layer.style.height = `${layerH}px`; });
  stream.style.transition = `height ${fillMs}ms linear`;
  stream.style.height = `${surfaceY - amount * layerH - pourY}px`;
  await wait(fillMs);

  // Stream pulls away from the mouth, then the bottle goes home.
  stream.style.transition = `top ${STREAM_MS}ms linear, height ${STREAM_MS}ms linear`;
  stream.style.top = `${surfaceY - amount * layerH}px`;
  stream.style.height = "0px";
  await wait(STREAM_MS);
  stream.remove();

  srcEl.style.transform = "";
  await wait(MOVE_MS);
}

undoBtn.addEventListener("click", () => {
  if (animating || history.length === 0) return;
  bottles = history.pop();
  moves--;
  selected = null;
  render();
});

document.getElementById("restart").addEventListener("click", () => {
  if (!animating) resetToStart();
});
nextBtn.addEventListener("click", () => {
  levelIndex = (levelIndex + 1) % LEVELS.length;
  startLevel();
});

// ---------- players ----------

function askForName() {
  nameInput.value = loadLastPlayer();
  nameDialog.hidden = false;
  nameInput.focus();
  nameInput.select();
}

nameForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  playerName = name;
  saveLastPlayer(name);
  levelIndex = Math.min(loadProgress(name), LEVELS.length - 1);
  playerEl.textContent = name;
  nameDialog.hidden = true;
  startLevel();
});

document.getElementById("change-player").addEventListener("click", () => {
  if (!animating) askForName();
});

// ---------- boot ----------
// When hosted as a Claude page, an update to the page keeps the game in progress.
// Elsewhere window.claude doesn't exist and this just asks for a name.

window.claude?.hot?.snapshot?.(() => ({ playerName, levelIndex, bottles, history, moves }));

function boot(saved = {}) {
  if (!saved.playerName || !(saved.levelIndex < LEVELS.length)) return askForName();
  ({ playerName, levelIndex, bottles, history, moves } = saved);
  capacity = currentLevel().capacity;
  playerEl.textContent = playerName;
  render();
}

window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
