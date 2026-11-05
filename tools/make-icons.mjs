// Renders icons/icon.svg to the PNG sizes phones and browsers need, using
// headless Chrome. Run after changing the SVG: node tools/make-icons.mjs
// Set CHROME to Chrome's path if it isn't in the usual macOS location.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const chrome = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const iconsDir = fileURLToPath(new URL("../icons/", import.meta.url));
const svgUrl = pathToFileURL(join(iconsDir, "icon.svg")).href;

const SIZES = {
  "icon-192.png": 192,          // Android home screen
  "icon-512.png": 512,          // Android splash screen and install prompt
  "apple-touch-icon.png": 180,  // iPhone home screen
};

const work = mkdtempSync(join(tmpdir(), "bottle-icons-"));
try {
  for (const [file, size] of Object.entries(SIZES)) {
    const page = join(work, `${size}.html`);
    writeFileSync(page, `<style>html,body{margin:0;overflow:hidden}</style><img src="${svgUrl}" width="${size}" height="${size}">`);
    execFileSync(chrome, [
      "--headless=new", "--hide-scrollbars", `--user-data-dir=${join(work, "profile")}`,
      `--window-size=${size},${size}`, `--screenshot=${join(iconsDir, file)}`, pathToFileURL(page).href,
    ], { stdio: "ignore" });
    // A PNG stores its width and height at bytes 16-23.
    const png = readFileSync(join(iconsDir, file));
    console.log(`${file}: ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
