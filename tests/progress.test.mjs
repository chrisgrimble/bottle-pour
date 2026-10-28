import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "./helpers.mjs";

// A minimal stand-in for document.cookie: setting "name=value; attrs" stores
// it, max-age=0 deletes it, and reading returns "a=1; b=2".
function fakeDocument({ cookiesWork = true } = {}) {
  const jar = new Map();
  return {
    jar,
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(text) {
      if (!cookiesWork) return;  // like Chrome on a file:// page
      const [pair, ...attrs] = text.split(";").map(s => s.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      if (attrs.some(a => a === "max-age=0")) jar.delete(name);
      else jar.set(name, pair.slice(eq + 1));
    },
  };
}

function fakeLocalStorage() {
  const items = new Map();
  return {
    items,
    getItem: k => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => items.set(k, String(v)),
  };
}

function loadProgress({ cookiesWork = true } = {}) {
  const document = fakeDocument({ cookiesWork });
  const localStorage = fakeLocalStorage();
  const run = loadScripts(["progress.js"], { document, localStorage });
  return { run, document, localStorage };
}

const progressOf = (run, name) => run(`loadProgress(${JSON.stringify(name)})`);

test("a new player starts at level 1 with no stars", () => {
  const { run } = loadProgress();
  assert.deepEqual(progressOf(run, "Alice"), { unlocked: 0, stars: [] });
});

test("progress round-trips through a cookie when cookies work", () => {
  const { run, document, localStorage } = loadProgress();
  run(`saveProgress("Alice", { unlocked: 4, stars: [3, 2, 1, 3] })`);
  assert.deepEqual(progressOf(run, "Alice"), { unlocked: 4, stars: [3, 2, 1, 3] });
  assert.ok(document.jar.has("bottlePour_player_alice"), "stored in a cookie");
  assert.equal(localStorage.items.size, 0, "not in localStorage");
});

test("falls back to localStorage when cookies don't stick", () => {
  const { run, document, localStorage } = loadProgress({ cookiesWork: false });
  run(`saveProgress("Alice", { unlocked: 2, stars: [3, 3] })`);
  assert.deepEqual(progressOf(run, "Alice"), { unlocked: 2, stars: [3, 3] });
  assert.equal(document.jar.size, 0);
  assert.ok(localStorage.items.has("bottlePour_player_alice"));
});

test("names match regardless of case and surrounding spaces", () => {
  const { run } = loadProgress();
  run(`saveProgress("Alice", { unlocked: 5, stars: [] })`);
  assert.equal(progressOf(run, "  aLiCe ").unlocked, 5);
  assert.equal(progressOf(run, "Bob").unlocked, 0, "other players are separate");
});

test("names with spaces and symbols are stored safely", () => {
  const { run } = loadProgress();
  run(`saveProgress("Mary-Jane O'Neil; x=1", { unlocked: 3, stars: [1] })`);
  assert.deepEqual(progressOf(run, "mary-jane o'neil; x=1"), { unlocked: 3, stars: [1] });
});

test("old saves that stored just a level number still load", () => {
  const { run, document } = loadProgress();
  document.jar.set("bottlePour_player_alice", "5");
  assert.deepEqual(progressOf(run, "Alice"), { unlocked: 5, stars: [] });
});

test("a corrupted save starts fresh instead of crashing", () => {
  const { run, document } = loadProgress();
  document.jar.set("bottlePour_player_alice", encodeURIComponent("{not json"));
  assert.deepEqual(progressOf(run, "Alice"), { unlocked: 0, stars: [] });
  document.jar.set("bottlePour_player_alice", encodeURIComponent(JSON.stringify({ unlocked: -3, stars: "x" })));
  assert.deepEqual(progressOf(run, "Alice"), { unlocked: 0, stars: [] });
});

test("a page can keep its saves under a separate prefix", () => {
  const document = fakeDocument();
  const run = loadScripts(["progress.js"], { document, localStorage: fakeLocalStorage(), BOTTLE_POUR_STORAGE_PREFIX: "bottlePourTest_" });
  run(`saveProgress("Alice", { unlocked: 1, stars: [3] })`);
  assert.ok(document.jar.has("bottlePourTest_player_alice"));
  assert.ok(!document.jar.has("bottlePour_player_alice"), "the real game's save is untouched");
});

test("the last player's name is remembered", () => {
  const { run } = loadProgress();
  assert.equal(run("loadLastPlayer()"), "");
  run(`saveLastPlayer("  Chris  ")`);
  assert.equal(run("loadLastPlayer()"), "Chris");
});
