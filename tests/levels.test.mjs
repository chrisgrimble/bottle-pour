import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, replay } from "./helpers.mjs";

const run = loadScripts(["rules.js", "levels.js"]);
const LEVELS = run("LEVELS");
// Each level's plain colours, and which of its layers are hidden at the start.
const COLOURS = run("LEVELS.map(levelColours)");
const HIDDEN = run("LEVELS.map(l => levelSpecials(l).map(b => b.map(s => !!s.hidden)))");
const hiddenCount = i => HIDDEN[i].flat().filter(Boolean).length;
// Every layer below the top is hidden, and nothing else.
const hidesAllBelowTop = i => HIDDEN[i].every(b => b.every((h, depth) => h === (depth < b.length - 1)));

test("there are 45 levels and the first has 3 bottles", () => {
  assert.equal(LEVELS.length, 45);
  assert.equal(LEVELS[0].bottles.length, 3);
});

// Levels 19-43 are a steady block between levels 18 and 44 (indexes 18-42).
const BLOCK_START = 18, BLOCK_END = 43;
const block = LEVELS.slice(BLOCK_START, BLOCK_END);
const blockIndexes = [...Array(BLOCK_END - BLOCK_START).keys()].map(i => i + BLOCK_START);

test("the steady block is as hard as level 18, with 5 breathers as hard as level 16", () => {
  const level16 = LEVELS[15].par, level18 = LEVELS[17].par;
  assert.equal(block.filter(l => l.par === level18).length, 20);
  assert.equal(block.filter(l => l.par === level16).length, 5);
});

test("nothing before the steady block hides layers", () => {
  for (let i = 0; i < BLOCK_START; i++) assert.equal(hiddenCount(i), 0, `level ${i + 1}`);
});

const SOME_HIDDEN = [20, 24, 30, 36, 41];
const ALL_HIDDEN = [22, 26, 28, 32, 34, 38, 40, 43];

test("8 levels hide every layer below the top", () => {
  const all = blockIndexes.filter(i => hiddenCount(i) > 0 && hidesAllBelowTop(i)).map(i => i + 1);
  assert.deepEqual(all, ALL_HIDDEN);
});

test("5 levels hide only some layers, with a hidden layer above a visible one", () => {
  const some = blockIndexes.filter(i => hiddenCount(i) > 0 && !hidesAllBelowTop(i)).map(i => i + 1);
  assert.deepEqual(some, SOME_HIDDEN);
  for (const level of SOME_HIDDEN) {
    const mixed = HIDDEN[level - 1].some(b => b.some((h, depth) => h && b.slice(0, depth).some(x => !x)));
    assert.ok(mixed, `level ${level} has no hidden layer above a visible one`);
  }
});

test("players meet partly hidden layers before fully hidden ones", () => {
  assert.ok(SOME_HIDDEN[0] < ALL_HIDDEN[0]);
});

test("no puzzle appears twice", () => {
  const keys = COLOURS.map(bottles => JSON.stringify(bottles.map(b => b.join(",")).sort()));
  assert.equal(new Set(keys).size, LEVELS.length);
});

test("outside the steady block, levels never get easier", () => {
  // Compare each level with the one before it, treating the block as one step.
  const outside = [...LEVELS.slice(0, BLOCK_START), ...LEVELS.slice(BLOCK_END)];
  for (let i = 1; i < outside.length; i++) {
    assert.ok(outside[i].par >= outside[i - 1].par, `par ${outside[i].par} after par ${outside[i - 1].par}`);
  }
});

test("the steady block stays between level 15 and level 18 difficulty", () => {
  for (const level of block) {
    assert.ok(level.par >= LEVELS[14].par && level.par <= LEVELS[17].par, `par ${level.par}`);
  }
});

for (const [i, level] of LEVELS.entries()) {
  const name = `level ${i + 1}`;
  const bottles = COLOURS[i];

  test(`${name}: each colour fills exactly one bottle and nothing overflows`, () => {
    const counts = {};
    for (const bottle of bottles) {
      assert.ok(bottle.length <= level.capacity, `a bottle holds ${bottle.length} > ${level.capacity}`);
      for (const colour of bottle) counts[colour] = (counts[colour] || 0) + 1;
    }
    for (const [colour, count] of Object.entries(counts)) {
      assert.equal(count, level.capacity, `colour ${colour} appears ${count} times`);
    }
  });

  test(`${name}: no bottle starts already sorted`, () => {
    for (const bottle of bottles) {
      if (bottle.length) assert.ok(!bottle.every(c => c === bottle[0]), `sorted bottle ${bottle}`);
    }
  });

  test(`${name}: special layers are written correctly and no top layer is hidden`, () => {
    for (const bottle of level.bottles) {
      bottle.forEach((layer, depth) => {
        if (typeof layer === "number") return;
        assert.deepEqual(Object.keys(layer).sort(), ["colour", "hidden"], JSON.stringify(layer));
        assert.equal(layer.hidden, true);
        assert.ok(depth < bottle.length - 1, "a top layer is marked hidden");
      });
    }
  });

  test(`${name}: can be won in exactly par moves`, () => {
    const path = run(`solve(levelColours(LEVELS[${i}]), ${level.capacity})`);
    assert.ok(Array.isArray(path), "no solution found");
    assert.equal(path.length, level.par);
    const end = replay(run, bottles, level.capacity, path);
    assert.equal(run(`isWon(${JSON.stringify(end)}, ${level.capacity})`), true);
  });
}
