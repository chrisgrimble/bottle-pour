import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, replay } from "./helpers.mjs";

const run = loadScripts(["rules.js", "levels.js"]);
const LEVELS = run("LEVELS");

test("there are 40 levels and the first has 3 bottles", () => {
  assert.equal(LEVELS.length, 40);
  assert.equal(LEVELS[0].bottles.length, 3);
});

// Levels 19-38 are a steady block between levels 18 and 39 (indexes 18-37).
const BLOCK_START = 18, BLOCK_END = 38;
const block = LEVELS.slice(BLOCK_START, BLOCK_END);

test("the steady block is as hard as level 18, with 5 breathers as hard as level 16", () => {
  const level16 = LEVELS[15].par, level18 = LEVELS[17].par;
  assert.equal(block.filter(l => l.par === level18).length, 15);
  assert.equal(block.filter(l => l.par === level16).length, 5);
});

test("some but not all of the steady block hides layers, and nothing earlier does", () => {
  const hiddenCount = block.filter(l => l.hidden).length;
  assert.ok(hiddenCount > 0 && hiddenCount < block.length, `${hiddenCount} of ${block.length} hidden`);
  assert.ok(LEVELS.slice(0, BLOCK_START).every(l => !l.hidden), "the early levels don't hide layers");
});

test("no puzzle appears twice", () => {
  const keys = LEVELS.map(l => JSON.stringify(l.bottles.map(b => b.join(",")).sort()));
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

  test(`${name}: each colour fills exactly one bottle and nothing overflows`, () => {
    const counts = {};
    for (const bottle of level.bottles) {
      assert.ok(bottle.length <= level.capacity, `a bottle holds ${bottle.length} > ${level.capacity}`);
      for (const colour of bottle) counts[colour] = (counts[colour] || 0) + 1;
    }
    for (const [colour, count] of Object.entries(counts)) {
      assert.equal(count, level.capacity, `colour ${colour} appears ${count} times`);
    }
  });

  test(`${name}: no bottle starts already sorted`, () => {
    for (const bottle of level.bottles) {
      if (bottle.length) assert.ok(!bottle.every(c => c === bottle[0]), `sorted bottle ${bottle}`);
    }
  });

  test(`${name}: can be won in exactly par moves`, () => {
    const path = run(`solve(LEVELS[${i}].bottles, ${level.capacity})`);
    assert.ok(Array.isArray(path), "no solution found");
    assert.equal(path.length, level.par);
    const end = replay(run, level.bottles, level.capacity, path);
    assert.equal(run(`isWon(${JSON.stringify(end)}, ${level.capacity})`), true);
  });
}
