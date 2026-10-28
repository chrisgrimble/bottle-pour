// Loads the game's browser scripts into a sandbox so tests can call them.

import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

// Runs the given scripts in one shared sandbox, like <script> tags on a page.
// `globals` provides browser objects such as document or localStorage.
// Returns a function that evaluates an expression inside the sandbox, which
// also reaches top-level const/let values (e.g. LEVELS) that aren't globals.
// Results come back as plain data (via JSON), because objects made inside the
// sandbox belong to a different realm and fail assert.deepStrictEqual.
export function loadScripts(files, globals = {}) {
  const context = vm.createContext({ ...globals });
  for (const file of files) {
    vm.runInContext(readFileSync(new URL(file, root), "utf8"), context, { filename: file });
  }
  return expr => {
    const json = vm.runInContext(`JSON.stringify((${expr}))`, context);
    return json === undefined ? undefined : JSON.parse(json);
  };
}

// Plays a list of [from, to] pours with the game's own rules and returns the
// final state, failing if any pour isn't allowed.
export function replay(run, start, cap, path) {
  return run(`(() => {
    const state = cloneState(${JSON.stringify(start)});
    for (const [from, to] of ${JSON.stringify(path)}) {
      if (!canPour(state, from, to, ${cap})) throw new Error("illegal pour " + from + "->" + to);
      pour(state, from, to, ${cap});
    }
    return state;
  })()`);
}
