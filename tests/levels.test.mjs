import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts, replay } from "./helpers.mjs";

const run = loadScripts(["rules.js", "levels.js"]);
const LEVELS = run("LEVELS");

test("there are 20 levels and the first has 3 bottles", () => {
  assert.equal(LEVELS.length, 20);
  assert.equal(LEVELS[0].bottles.length, 3);
});

test("levels never get easier: par doesn't go down", () => {
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].par >= LEVELS[i - 1].par, `level ${i + 1} par ${LEVELS[i].par} < level ${i} par ${LEVELS[i - 1].par}`);
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
