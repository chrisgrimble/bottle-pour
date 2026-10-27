// Game rules, shared by game.js and tools/generate-levels.mjs.
// A state is an array of bottles; each bottle lists colour ids bottom -> top.

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

function cloneState(state) {
  return state.map(b => b.slice());
}
