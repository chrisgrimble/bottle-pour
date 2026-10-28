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

test("startingHidden hides everything below the top, only on hidden levels", () => {
  const bottles = [[0, 1, 2, 3], [1, 2], [3], []];
  assert.deepEqual(call("startingHidden", { hidden: true, bottles }), [3, 1, 0, 0]);
  assert.deepEqual(call("startingHidden", { bottles }), [0, 0, 0, 0]);
});

test("revealLayers turns up a layer once it's on top", () => {
  // Bottle 0 had 3 face down; pouring its top away leaves 3 layers, so one shows.
  assert.deepEqual(call("revealLayers", [[0, 1, 2], [3, 3]], [3, 1], 4), [2, 1]);
});

test("revealLayers never hides a layer again, e.g. after an undo", () => {
  // Undo put a layer back on top of bottle 0; the one revealed below stays up.
  assert.deepEqual(call("revealLayers", [[0, 1, 2, 3], [3]], [2, 0], 4), [2, 0]);
});

test("revealLayers shows everything in a finished bottle", () => {
  assert.deepEqual(call("revealLayers", [[1, 1, 1, 1], [0, 2]], [3, 1], 4), [0, 1]);
});

test("revealLayers leaves empty bottles with nothing hidden", () => {
  assert.deepEqual(call("revealLayers", [[], [2]], [3, 0], 4), [0, 0]);
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
