// Bundles index.html and its scripts into one self-contained HTML file.
//
// Usage:
//   node tools/bundle.mjs [--levels FILE] [--out FILE] [--title TEXT]
//                         [--storage PREFIX] [--fragment]
//
//   --levels   use this levels file instead of levels.js
//   --out      where to write it (default dist/bottle-pour.html)
//   --title    the page title
//   --storage  keep saved progress under this prefix, separate from the game
//   --fragment write only the page body, for publishing as a Claude page

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = fileURLToPath(new URL("..", import.meta.url));
const { values: opts } = parseArgs({
  options: {
    levels: { type: "string", default: "levels.js" },
    out: { type: "string", default: "dist/bottle-pour.html" },
    title: { type: "string", default: "Bottle Pour" },
    storage: { type: "string" },
    fragment: { type: "boolean", default: false },
  },
});

const read = file => readFileSync(join(root, file), "utf8");
const html = read("index.html");
const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
let body = html.match(/<body>([\s\S]*)<\/body>/)[1].trim();

const inline = code => `<script>\n${code.replace(/<\/script/gi, "<\\/script")}\n</script>`;
body = body.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  inline(read(src === "levels.js" ? opts.levels : src)));
if (opts.storage) {
  body = inline(`var BOTTLE_POUR_STORAGE_PREFIX = ${JSON.stringify(opts.storage)};`) + "\n" + body;
}

const title = opts.title.replace(/</g, "&lt;");
const page = opts.fragment
  ? `<title>${title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${style}\n${body}\n`
  : `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n` +
    `  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
    `  <title>${title}</title>\n  ${style}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;

const out = resolve(root, opts.out);  // relative to the project, or absolute
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Wrote ${opts.out} (${Math.round(page.length / 1024)} KB)`);
