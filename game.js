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
let progress = { unlocked: 0, stars: [] };   // see progress.js
let levelIndex = 0;
let capacity = 4;
let bottles = [];        // current state: array of arrays, bottom -> top
let history = [];        // previous states, for Undo
let moves = 0;
let selected = null;
let hintsUsed = 0;       // on this attempt; any hint caps the stars at 2
let hint = null;         // [from, to] being suggested, until the next pour
let hidden = [];         // face-down layers at the bottom of each bottle (see rules.js)
let hiddenBefore = null; // hidden counts before the last pour, to animate what it revealed

// ---------- UI ----------

const boardEl = document.getElementById("board");
const levelEl = document.getElementById("level");
const movesEl = document.getElementById("moves");
const undoBtn = document.getElementById("undo");
const winEl = document.getElementById("win");
const winText = document.getElementById("win-text");

const nextBtn = document.getElementById("next");
const winStarsEl = document.getElementById("win-stars");
const levelsDialog = document.getElementById("levels-dialog");
const levelGrid = document.getElementById("level-grid");
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
  hidden = startingHidden(currentLevel());
  hiddenBefore = null;
  history = [];
  moves = 0;
  hintsUsed = 0;
  hint = null;
  showMessage("");
  document.querySelectorAll(".confetti").forEach(c => c.remove());
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
    el.className = "bottle" + (selected === i ? " selected" : "") +
      (isComplete(bottle) ? " complete" : "") +
      (hint && hint[0] === i ? " hint-from" : "") +
      (hint && hint[1] === i ? " hint-to" : "");
    // Height scales with capacity, plus a little headroom for the neck.
    el.style.height = `calc(var(--layer-h) * ${capacity} + 16px)`;
    bottle.forEach((colour, depth) => {
      const layer = document.createElement("div");
      layer.className = "layer";
      if (depth < (hidden[i] || 0)) {
        layer.classList.add("face-down");
        layer.textContent = "?";
      } else {
        layer.style.background = PALETTE[colour % PALETTE.length];
        if (hiddenBefore && depth < (hiddenBefore[i] || 0)) layer.classList.add("revealed");
      }
      el.appendChild(layer);
    });
    if (hidden[i]) {
      el.setAttribute("aria-label", `${hidden[i]} hidden layer${hidden[i] === 1 ? "" : "s"}`);
    }
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
      sounds.invalid();
      shake(i);
      return;
    }
    sounds.pickUp();
    selected = i;
    render();
    return;
  }

  if (selected === i) {
    sounds.putDown();
    selected = null;
    render();
    return;
  }

  const from = selected;
  selected = null;
  if (!canPour(bottles, from, i, capacity)) {
    sounds.invalid();
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
    hint = null;
    showMessage("");
    hiddenBefore = hidden;
    hidden = revealLayers(bottles, hidden, capacity);
    if (hidden.some((h, b) => h < (hiddenBefore[b] || 0))) sounds.reveal();
    render();
    hiddenBefore = null;

    if (isComplete(bottles[i])) {
      celebrateBottle(boardEl.children[i], PALETTE[bottles[i][0] % PALETTE.length]);
    }
    if (isWon(bottles, capacity)) {
      sounds.win();
      celebrateWin(PALETTE);
      showWin();
    } else if (isComplete(bottles[i])) {
      sounds.bottleDone();
    }
  });
}

// Full of a single colour.
function isComplete(bottle) {
  return bottle.length === capacity && isWon([bottle], capacity);
}

// ---------- stars ----------

const MAX_STARS = 3;

function starText(count) {
  return "★".repeat(count) + "☆".repeat(MAX_STARS - count);
}

function showWin() {
  const par = currentLevel().par;
  const earned = Math.min(starsFor(moves, par), hintsUsed ? HINT_STAR_CAP : MAX_STARS);
  const lastLevel = levelIndex === LEVELS.length - 1;
  const best = progress.stars[levelIndex] || 0;

  progress.stars[levelIndex] = Math.max(best, earned);
  progress.unlocked = Math.max(progress.unlocked, Math.min(levelIndex + 1, LEVELS.length - 1));
  saveProgress(playerName, progress);

  winStarsEl.innerHTML = "";
  for (let s = 0; s < MAX_STARS; s++) {
    const star = document.createElement("span");
    star.className = "star" + (s < earned ? " earned" : "");
    star.textContent = s < earned ? "★" : "☆";
    star.style.animationDelay = `${s * 0.15}s`;
    winStarsEl.appendChild(star);
  }
  winStarsEl.setAttribute("aria-label", `${earned} of ${MAX_STARS} stars`);

  let text = `Solved in ${moves} move${moves === 1 ? "" : "s"}. Best possible: ${par}.`;
  if (hintsUsed && earned === HINT_STAR_CAP) {
    text += ` Solve it without a hint in ${par} moves for 3 stars.`;
  } else if (earned < MAX_STARS) {
    text += ` Get it in ${earned === 1 ? Math.ceil(par * 1.5) : par} for ${earned + 1} stars.`;
  }
  if (best > earned) text += ` Your best here is ${best} stars.`;
  if (lastLevel) text += " You've completed every level!";
  winText.textContent = text;
  nextBtn.textContent = lastLevel ? "Play again" : "Next level";
  winEl.hidden = false;
}

// ---------- level select ----------

function openLevels() {
  levelGrid.innerHTML = "";
  LEVELS.forEach((level, i) => {
    const locked = i > progress.unlocked;
    const stars = progress.stars[i] || 0;
    const tile = document.createElement("button");
    tile.className = "level-tile" + (i === levelIndex ? " current" : "");
    tile.disabled = locked;
    tile.setAttribute("aria-label", locked
      ? `Level ${i + 1}, locked`
      : `Level ${i + 1}, ${stars ? `${stars} of ${MAX_STARS} stars` : "not solved yet"}`);
    tile.innerHTML =
      `<span class="tile-number">${i + 1}</span>` +
      `<span class="tile-stars">${locked ? "🔒" : starText(stars)}</span>`;
    tile.addEventListener("click", () => {
      levelsDialog.hidden = true;
      levelIndex = i;
      startLevel();
    });
    levelGrid.appendChild(tile);
  });
  const total = progress.stars.reduce((sum, s) => sum + (s || 0), 0);
  document.getElementById("star-total").textContent = `${total} / ${LEVELS.length * MAX_STARS} stars`;
  winEl.hidden = true;
  levelsDialog.hidden = false;
}

document.getElementById("levels").addEventListener("click", () => {
  if (!animating) openLevels();
});
document.getElementById("win-levels").addEventListener("click", openLevels);
document.getElementById("close-levels").addEventListener("click", () => {
  levelsDialog.hidden = true;
});

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
  const amount = Math.min(topRun(bottles[from]), capacity - bottles[to].length);
  const fromFill = bottles[to].length / capacity;
  const toFill = (bottles[to].length + amount) / capacity;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sounds.pour(300, fromFill, toFill);
    return;
  }

  const srcEl = boardEl.children[from];
  const dstEl = boardEl.children[to];
  const layerH = parseFloat(getComputedStyle(srcEl).getPropertyValue("--layer-h"));
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
  sounds.pour(fillMs, fromFill, toFill);
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
  hint = null;
  showMessage("");
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
  progress = loadProgress(name);
  progress.unlocked = Math.min(progress.unlocked, LEVELS.length - 1);
  levelIndex = progress.unlocked;
  playerEl.textContent = name;
  nameDialog.hidden = true;
  startLevel();
});

document.getElementById("change-player").addEventListener("click", () => {
  if (!animating) askForName();
});

// ---------- hints ----------

const HINT_STAR_CAP = 2;
const HINT_SEARCH_LIMIT = 200000;  // states; keeps the page responsive
const messageEl = document.getElementById("message");
let messageTimer = null;

function showMessage(text) {
  clearTimeout(messageTimer);
  messageEl.textContent = text;
  if (text) messageTimer = setTimeout(() => { messageEl.textContent = ""; }, 6000);
}

function showHint() {
  if (animating || !winEl.hidden) return;
  selected = null;
  render();

  // The solver sees every colour, so a hint would give hidden layers away.
  if (hidden.some(h => h > 0)) {
    showMessage("Hints switch on once every hidden layer has been uncovered.");
    return;
  }

  const path = solve(bottles, capacity, HINT_SEARCH_LIMIT);
  if (path === null) {
    sounds.invalid();
    showMessage("There's no way to win from here. Undo a few moves or restart.");
    return;
  }
  if (path === undefined) {
    showMessage("Too many possibilities to work out a hint here. Try undoing a few moves.");
    return;
  }
  if (path.length === 0) return;

  hint = path[0];
  hintsUsed++;
  render();
  sounds.hint();
  showMessage(`Pour the gold bottle into the white one. ` +
    `${path.length} move${path.length === 1 ? "" : "s"} to go at best.` +
    (hintsUsed === 1 ? " Hints limit this level to 2 stars." : ""));
}

document.getElementById("hint").addEventListener("click", showHint);

const soundBtn = document.getElementById("sound");

function showSoundSetting() {
  soundBtn.textContent = isMuted() ? "Sound off" : "Sound on";
  soundBtn.setAttribute("aria-pressed", String(!isMuted()));
}

soundBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  showSoundSetting();
  sounds.pickUp();  // a little confirmation when turning sound on
});
showSoundSetting();

// ---------- boot ----------
// When hosted as a Claude page, an update to the page keeps the game in progress.
// Elsewhere window.claude doesn't exist and this just asks for a name.

window.claude?.hot?.snapshot?.(() => ({ playerName, levelIndex, bottles, history, moves, hintsUsed, hidden }));

function boot(saved = {}) {
  if (!saved.playerName || !(saved.levelIndex < LEVELS.length)) return askForName();
  ({ playerName, levelIndex, bottles, history, moves } = saved);
  hintsUsed = saved.hintsUsed || 0;
  hidden = saved.hidden || startingHidden(currentLevel());
  progress = loadProgress(playerName);
  capacity = currentLevel().capacity;
  playerEl.textContent = playerName;
  render();
}

window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
