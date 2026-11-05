// Checks the pieces that let the game install as an app and run offline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = file => readFileSync(new URL(file, root), "utf8");
const exists = file => existsSync(new URL(file, root));

const manifest = JSON.parse(read("manifest.webmanifest"));
const indexHtml = read("index.html");
// The list of files the service worker saves for offline play.
const offlineFiles = JSON.parse(read("sw.js").match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));

// A PNG stores its width and height at bytes 16-23.
function pngSize(file) {
  const png = readFileSync(new URL(file, root));
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

test("the manifest has what Chrome needs to install the app", () => {
  assert.equal(manifest.name, "Bottle Pour");
  assert.ok(manifest.short_name);
  assert.equal(manifest.start_url, "./");
  assert.ok(["standalone", "fullscreen", "minimal-ui"].includes(manifest.display));
  const sizes = manifest.icons.map(i => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  assert.ok(manifest.icons.some(i => i.purpose === "maskable"), "has an icon Android can crop");
});

test("every icon in the manifest exists at its stated size", () => {
  for (const icon of manifest.icons) {
    assert.ok(exists(icon.src), `${icon.src} is missing`);
    assert.equal(pngSize(icon.src), icon.sizes, icon.src);
  }
  assert.equal(pngSize("icons/apple-touch-icon.png"), "180x180");
});

test("index.html links the manifest and icons, and they exist", () => {
  for (const href of indexHtml.matchAll(/<link rel="(?:manifest|icon|apple-touch-icon)" href="([^"]+)"/g)) {
    assert.ok(exists(href[1]), `${href[1]} is missing`);
  }
  assert.match(indexHtml, /<link rel="manifest" href="manifest.webmanifest">/);
});

test("every file the service worker saves for offline play exists", () => {
  for (const file of offlineFiles) {
    if (file !== "./") assert.ok(exists(file), `${file} is missing`);
  }
});

test("offline play saves every script the page loads", () => {
  const scripts = [...indexHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length > 0);
  for (const src of scripts) assert.ok(offlineFiles.includes(src), `${src} isn't saved for offline play`);
});
