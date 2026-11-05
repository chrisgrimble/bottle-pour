import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, replay } from "./helpers.mjs";

const run = loadScripts(["rules.js"]);
const call = (fn, ...args) => run(`${fn}(...${JSON.stringify(args)})`);

// Bottles are listed bottom -> top; numbers are colours.

test("topRun counts the matching layers on top", () => {
  assert.equal(call("topRun", [0, 1, 1]), 2);
  assert.equal(call("topRun", [1, 1, 1, 1]), 4);
  assert.equal(call("topRun", [1, 0]), 1);
  assert.equal(call("topRun", []), 0);
});

test("canPour into an empty bottle", () => {
  assert.equal(call("canPour", [[0, 1], []], 0, 1, 4), true);
});

test("canPour onto a matching colour with room", () => {
  assert.equal(call("canPour", [[0, 1], [2, 1]], 0, 1, 4), true);
});

test("canPour refuses a different top colour", () => {
  assert.equal(call("canPour", [[0, 1], [1, 0]], 0, 1, 4), false);
});

test("canPour refuses a full target", () => {
  assert.equal(call("canPour", [[1], [2, 2, 2, 1]], 0, 1, 4), false);
});

test("canPour refuses an empty source and the same bottle", () => {
  assert.equal(call("canPour", [[], []], 0, 1, 4), false);
  assert.equal(call("canPour", [[0, 1], []], 0, 0, 4), false);
});

test("pour moves the whole matching run when it fits", () => {
  const state = run(`(() => { const s = [[0, 1, 1], []]; pour(s, 0, 1, 4); return s; })()`);
  assert.deepEqual(state, [[0], [1, 1]]);
});

test("pour moves only as many layers as fit", () => {
  const state = run(`(() => { const s = [[0, 1, 1, 1], [2, 2, 1]]; pour(s, 0, 1, 4); return s; })()`);
  assert.deepEqual(state, [[0, 1, 1], [2, 2, 1, 1]]);
});

test("isWon needs every bottle empty or full of one colour", () => {
  assert.equal(call("isWon", [[0, 0, 0, 0], [1, 1, 1, 1], []], 4), true);
  assert.equal(call("isWon", [[0, 0], [1, 1, 1, 1], [0, 0]], 4), false, "one colour but not full");
  assert.equal(call("isWon", [[0, 0, 0, 1], [1, 1, 1, 0]], 4), false, "mixed colours");
});

test("cloneState makes an independent copy", () => {
  const [original, copy] = run(`(() => { const a = [[0, 1]]; const b = cloneState(a); b[0].push(2); return [a, b]; })()`);
  assert.deepEqual(original, [[0, 1]]);
  assert.deepEqual(copy, [[0, 1, 2]]);
});

test("solve returns [] for a won state", () => {
  assert.deepEqual(call("solve", [[0, 0], [1, 1], []], 2), []);
});

test("solve finds the shortest win", () => {
  const start = [[0, 1], [1, 0], []];
  const path = call("solve", start, 2);
  assert.equal(path.length, 3);
  assert.equal(call("isWon", replay(run, start, 2, path), 2), true);
});

test("solve returns null when the position can't be won", () => {
  // A real dead end reached from level 4.
  assert.equal(call("solve", [[2, 0, 0, 1], [0, 2, 1, 1], [2, 1, 0], [2]], 4), null);
});

test("solve returns undefined when it hits its search limit", () => {
  const start = [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2], [], []];
  assert.equal(call("solve", start, 4, 5), undefined);
});

// ---------- special layers ----------

const H = colour => ({ colour, hidden: true });  // a hidden layer in a level
const hiddenMap = specials => specials.map(b => b.map(s => (s.hidden ? "?" : "o")).join(""));

test("pour reports how many layers it moved", () => {
  assert.equal(run(`pour([[0, 1, 1, 1], [2, 2, 1]], 0, 1, 4)`), 1);
  assert.equal(run(`pour([[0, 1, 1], []], 0, 1, 4)`), 2);
});

test("levelColours reads plain and special layers alike", () => {
  const level = { capacity: 4, bottles: [[0, H(1), 2, 3], [H(2), 1], []] };
  assert.deepEqual(call("levelColours", level), [[0, 1, 2, 3], [2, 1], []]);
});

test("levelSpecials marks exactly the layers the level hides, and any layer can be hidden", () => {
  // A hidden layer above a visible one, and visible layers between hidden ones.
  const level = { capacity: 4, bottles: [[0, H(1), 2, 3], [H(0), 1, H(2), 3], [3]] };
  assert.deepEqual(hiddenMap(call("levelSpecials", level)), ["o?oo", "?o?o", "o"]);
});

test("a level can't hide a top layer: it starts face up", () => {
  const level = { capacity: 4, bottles: [[0, H(1)], [H(2)]] };
  assert.deepEqual(hiddenMap(call("levelSpecials", level)), ["oo", "o"]);
});

test("a hidden layer turns face up when it's uncovered", () => {
  // Bottle 0 was [0, ?1, 2, 3] and its top 3 was just poured away.
  const after = run(`settleSpecials([[0, 1, 2], [3]], [[{}, { hidden: true }, {}], [{}]], 4)`);
  assert.deepEqual(hiddenMap(after), ["o?o", "o"], "still hidden: 2 is on top");
  const later = run(`settleSpecials([[0, 1], [3, 2]], [[{}, { hidden: true }], [{}, {}]], 4)`);
  assert.deepEqual(hiddenMap(later), ["oo", "oo"], "now on top, so face up");
});

test("a finished bottle shows all its layers", () => {
  const after = run(`settleSpecials([[1, 1, 1, 1]], [[{ hidden: true }, { hidden: true }, {}, {}]], 4)`);
  assert.deepEqual(hiddenMap(after), ["oooo"]);
});

test("settleSpecials doesn't change the specials it's given (undo keeps the old ones)", () => {
  // The hidden layer is now on top, so the settled copy shows it; the original stays hidden.
  const [before, after] = run(`(() => {
    const s = [[{}, { hidden: true }]];
    return [s, settleSpecials([[1, 2]], s, 4)];
  })()`);
  assert.deepEqual(before, [[{}, { hidden: true }]]);
  assert.deepEqual(after, [[{}, {}]]);
});

test("special properties travel with their layers when poured", () => {
  // Pretend a future special kind sits on the top two layers of bottle 0.
  const moved = run(`(() => {
    const state = [[0, 1, 1], []], specials = [[{}, { mark: "a" }, { mark: "b" }], []];
    pourSpecials(specials, 0, 1, pour(state, 0, 1, 4));
    return specials;
  })()`);
  // Poured one at a time, so the top layer lands first (at the bottom).
  assert.deepEqual(moved, [[{}], [{ mark: "b" }, { mark: "a" }]]);
});

test("hasHiddenLayers", () => {
  assert.equal(run(`hasHiddenLayers([[{}, { hidden: true }], []])`), true);
  assert.equal(run(`hasHiddenLayers([[{}, {}], []])`), false);
});

test("starsFor: 3 at par, 2 up to 50% over, 1 beyond", () => {
  assert.equal(call("starsFor", 10, 10), 3);
  assert.equal(call("starsFor", 9, 10), 3, "fewer than par still counts as 3");
  assert.equal(call("starsFor", 11, 10), 2);
  assert.equal(call("starsFor", 15, 10), 2);
  assert.equal(call("starsFor", 16, 10), 1);
  // Odd par rounds the 2-star limit up: 1.5 * 29 = 43.5 -> 44.
  assert.equal(call("starsFor", 44, 29), 2);
  assert.equal(call("starsFor", 45, 29), 1);
});
