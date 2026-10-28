// Generates levels.js: a fixed set of solvable levels, ordered by difficulty.
//
// Usage: node tools/generate-levels.mjs
//
// Each candidate puzzle is solved with solve() from rules.js, so every level
// written out is proven solvable, and its "par" is the fewest moves needed.
// Difficulty grows with the number of colours, and within a band of levels
// that share a size, with par.

import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

// Load the same rules the game uses (canPour, pour, isWon, ...) as globals.
vm.runInThisContext(readFileSync(new URL("../rules.js", import.meta.url), "utf8"));

// [colours, empty bottles, capacity, how many levels of this size]
const BANDS = [
  [2, 1, 4, 2],
  [3, 1, 4, 3],
  [4, 2, 4, 3],
  [5, 2, 4, 3],
  [6, 2, 4, 3],
  [7, 2, 4, 2],
  [8, 2, 4, 2],
  [9, 2, 4, 2],
];

const CANDIDATES_PER_BAND = 40;
const STATE_LIMIT = 3_000_000;
const SEED = 20261027;

// A run of levels at a steady difficulty, slotted in after level 18 of the
// bands above: mostly as hard as level 18 (par 25), with a few breathers as
// hard as level 16 (par 22). 7 or 8 colours, and some hide every layer below
// the top. Each level has its own seed, so the levels from BANDS come out the
// same as before and changing one plateau level doesn't reshuffle the others.
const LEVEL_16_PAR = 22;
const PLATEAU = {
  insertAfter: 18,
  par: 25,
  empty: 2,
  capacity: 4,
  seed: 20261028,
  maxTries: 5000,
  // One entry per level: [colours, hidden layers?, par (default PLATEAU.par)]
  levels: [
    [8, false], [7, false, LEVEL_16_PAR], [8, true], [7, false], [8, false],
    [7, true, LEVEL_16_PAR], [8, false], [7, true], [8, false], [7, false, LEVEL_16_PAR],
    [8, true], [7, false], [8, true], [7, false, LEVEL_16_PAR], [8, false],
    [7, true], [8, false], [7, true, LEVEL_16_PAR], [8, false], [8, true],
  ],
};

// ---------- generation ----------

// Small seeded RNG so the same levels come out every run.
let seed = SEED;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function deal(colours, empty, cap) {
  const pool = [];
  for (let c = 0; c < colours; c++) for (let i = 0; i < cap; i++) pool.push(c);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const s = [];
  for (let b = 0; b < colours; b++) s.push(pool.slice(b * cap, (b + 1) * cap));
  for (let e = 0; e < empty; e++) s.push([]);
  return s;
}

// No bottle should start already sorted - that gives part of the puzzle away.
const hasSortedBottle = s => s.some(b => b.length > 0 && b.every(c => c === b[0]));

const levels = [];
for (const [colours, empty, cap, count] of BANDS) {
  const found = [];
  let tries = 0;
  while (found.length < CANDIDATES_PER_BAND && tries < CANDIDATES_PER_BAND * 20) {
    tries++;
    const bottles = deal(colours, empty, cap);
    if (hasSortedBottle(bottles)) continue;
    // solve() comes from rules.js; skip puzzles too big to check or unwinnable.
    const path = solve(bottles, cap, STATE_LIMIT);
    if (!path || path.length === 0) continue;
    found.push({ bottles, par: path.length });
  }
  if (found.length < count) throw new Error(`Only found ${found.length} puzzles for ${colours} colours`);

  // Spread picks across the band from easier to harder.
  found.sort((a, b) => a.par - b.par);
  for (let i = 0; i < count; i++) {
    const at = Math.round(((i + 1) / (count + 1)) * (found.length - 1));
    levels.push({ capacity: cap, ...found[at] });
  }
  console.log(`${colours} colours: ${found.length} candidates, par ${found[0].par}-${found.at(-1).par}`);
}

// Deal puzzles until one needs exactly the wanted number of moves.
const plateau = PLATEAU.levels.map(([colours, hidden, par = PLATEAU.par], n) => {
  seed = PLATEAU.seed + n;
  for (let tries = 1; tries <= PLATEAU.maxTries; tries++) {
    const bottles = deal(colours, PLATEAU.empty, PLATEAU.capacity);
    if (hasSortedBottle(bottles)) continue;
    const path = solve(bottles, PLATEAU.capacity, STATE_LIMIT);
    if (path && path.length === par) {
      return { capacity: PLATEAU.capacity, par, ...(hidden && { hidden: true }), bottles };
    }
  }
  throw new Error(`No ${colours}-colour puzzle with par ${par} in ${PLATEAU.maxTries} tries`);
});
levels.splice(PLATEAU.insertAfter, 0, ...plateau);
console.log(`Plateau: ${plateau.length} levels after level ${PLATEAU.insertAfter}, ` +
  `par ${[...new Set(plateau.map(l => l.par))].join("/")}, ${plateau.filter(l => l.hidden).length} with hidden layers`);

const body = levels
  .map((l, i) => `  // Level ${i + 1}: ${l.bottles.length} bottles, par ${l.par}${l.hidden ? ", hidden layers" : ""}\n` +
    `  { capacity: ${l.capacity}, par: ${l.par}, ${l.hidden ? "hidden: true, " : ""}bottles: ${JSON.stringify(l.bottles)} },`)
  .join("\n");

writeFileSync(new URL("../levels.js", import.meta.url),
  `// Generated by tools/generate-levels.mjs - every level is checked solvable.\n` +
  `// Bottles are listed bottom -> top; numbers are colour ids.\n` +
  `const LEVELS = [\n${body}\n];\n`);

console.log(`Wrote ${levels.length} levels to levels.js`);
