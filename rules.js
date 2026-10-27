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

// Shortest list of pours that wins from this state, as [from, to] pairs.
// Returns [] if already won, null if it can't be won, or undefined if it gave
// up after looking at `limit` states.
function solve(start, cap, limit = 3000000) {
  if (isWon(start, cap)) return [];
  // Bottle order doesn't matter for solving, so sort to merge equivalent states.
  const key = s => s.map(b => b.join(",")).sort().join("|");
  // Each state remembers the state it came from and the pour that got there.
  const cameFrom = new Map([[key(start), null]]);
  let frontier = [start];
  while (frontier.length > 0) {
    const next = [];
    for (const s of frontier) {
      const sKey = key(s);
      for (let from = 0; from < s.length; from++) {
        for (let to = 0; to < s.length; to++) {
          if (!canPour(s, from, to, cap)) continue;
          const n = cloneState(s);
          pour(n, from, to, cap);
          const nKey = key(n);
          if (cameFrom.has(nKey)) continue;
          cameFrom.set(nKey, [sKey, from, to]);
          if (isWon(n, cap)) {
            const path = [];
            for (let step = cameFrom.get(nKey); step; step = cameFrom.get(step[0])) {
              path.unshift([step[1], step[2]]);
            }
            return path;
          }
          if (cameFrom.size > limit) return undefined;
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return null;
}
