import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "./helpers.mjs";

const run = loadScripts(["transfer.js"], { TextEncoder, TextDecoder, Uint8Array });
const encode = (name, progress) => run(`encodeTransfer(${JSON.stringify(name)}, ${JSON.stringify(progress)})`);
const decode = code => run(`decodeTransfer(${JSON.stringify(code)})`);

const alice = { unlocked: 22, stars: [3, 3, 2, 1, 3, 0, 2, 3, 3, 3, 1, 2, 3, 3, 3, 2, 3, 3, 3, 3, 2, 1] };

test("a code round-trips a player's progress", () => {
  assert.deepEqual(decode(encode("Alice", alice)), { name: "Alice", ...alice });
});

test("codes are short, grouped in fours, and use only unambiguous characters", () => {
  const code = encode("Alice", alice);
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{1,4}(-[0-9A-HJKMNP-TV-Z]{1,4})*$/);
  assert.ok(code.replace(/-/g, "").length <= 32, `${code} is too long`);
});

test("a full 40-level save still makes a short code", () => {
  const code = encode("Christopher", { unlocked: 39, stars: Array(40).fill(3) });
  assert.ok(code.replace(/-/g, "").length <= 48, code);
  assert.equal(decode(code).stars.length, 40);
});

test("a new player with no stars round-trips", () => {
  assert.deepEqual(decode(encode("Bob", { unlocked: 0, stars: [] })), { name: "Bob", unlocked: 0, stars: [] });
});

test("names with accents, spaces and emoji round-trip", () => {
  for (const name of ["Zoë", "Mary Jane", "李雷", "Sam 🎮"]) {
    assert.equal(decode(encode(name, { unlocked: 1, stars: [3] })).name, name);
  }
});

test("decoding forgives case, spaces, missing dashes and look-alike letters", () => {
  const code = encode("Alice", alice);
  assert.equal(decode(code.toLowerCase()).name, "Alice");
  assert.equal(decode(code.replace(/-/g, " ")).name, "Alice");
  assert.equal(decode(code.replace(/-/g, "")).name, "Alice");
  assert.equal(decode(code.replace(/0/g, "O").replace(/1/g, "l")).name, "Alice");
});

test("a mistyped code is rejected rather than giving the wrong progress", () => {
  const code = encode("Alice", alice).replace(/-/g, "");
  let rejected = 0, total = 0;
  for (let i = 0; i < code.length; i++) {
    for (const replacement of "0123456789ABCDEFGHJKMNPQRSTVWXYZ") {
      if (replacement === code[i]) continue;
      total++;
      if (decode(code.slice(0, i) + replacement + code.slice(i + 1)) === null) rejected++;
    }
  }
  // CRC-8 catches every single-character change.
  assert.equal(rejected, total);
});

test("swapping two neighbouring characters is caught", () => {
  const code = encode("Alice", alice).replace(/-/g, "");
  for (let i = 0; i < code.length - 1; i++) {
    if (code[i] === code[i + 1]) continue;
    const swapped = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2);
    assert.equal(decode(swapped), null, `swap at ${i}`);
  }
});

test("rubbish and cut-off codes are rejected", () => {
  const code = encode("Alice", alice);
  for (const bad of ["", "hello", "!!!!-????", "UUUU-UUUU", code.slice(0, 8), code.slice(0, -2)]) {
    assert.equal(decode(bad), null, JSON.stringify(bad));
  }
});

test("mergeProgress keeps the furthest level and the best stars from each save", () => {
  const here = { unlocked: 5, stars: [3, 1, 0, 2] };
  const there = { unlocked: 3, stars: [2, 3, 3] };
  assert.deepEqual(run(`mergeProgress(${JSON.stringify(here)}, ${JSON.stringify(there)})`), { unlocked: 5, stars: [3, 3, 3, 2] });
});
