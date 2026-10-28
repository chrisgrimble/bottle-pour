// Saves each player's level, keyed by their name.
//
// Progress goes in a cookie. Chrome ignores cookies on pages opened straight
// from disk (file://), so when cookies don't stick we fall back to localStorage.

const COOKIE_DAYS = 365;
// A page can set BOTTLE_POUR_STORAGE_PREFIX first to keep its saves separate
// (see the --storage option of tools/bundle.mjs).
const KEY_PREFIX = globalThis.BOTTLE_POUR_STORAGE_PREFIX ?? "bottlePour_";
const LAST_PLAYER_KEY = KEY_PREFIX + "lastPlayer";

// Names match regardless of case or surrounding spaces.
function playerKey(name) {
  return KEY_PREFIX + "player_" + encodeURIComponent(name.trim().toLowerCase());
}

const cookiesWork = (() => {
  try {
    document.cookie = `${KEY_PREFIX}test=1; path=/; SameSite=Lax`;
    const ok = document.cookie.includes(`${KEY_PREFIX}test=1`);
    document.cookie = `${KEY_PREFIX}test=; max-age=0; path=/`;
    return ok;
  } catch {
    return false;
  }
})();

function readValue(key) {
  if (cookiesWork) {
    const match = document.cookie.split("; ").find(c => c.startsWith(key + "="));
    return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeValue(key, value) {
  if (cookiesWork) {
    const maxAge = COOKIE_DAYS * 24 * 60 * 60;
    document.cookie = `${key}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (e.g. private browsing) - progress just won't be kept.
  }
}

// A player's progress: `unlocked` is the furthest level index they can play,
// `stars` holds their best star rating per level index (0 = not solved yet).
function loadProgress(name) {
  const fresh = { unlocked: 0, stars: [] };
  const raw = readValue(playerKey(name));
  if (raw === null) return fresh;
  // Older saves stored just the next level number.
  if (/^\d+$/.test(raw)) return { unlocked: parseInt(raw, 10), stars: [] };
  try {
    const saved = JSON.parse(raw);
    return {
      unlocked: Number.isInteger(saved.unlocked) && saved.unlocked >= 0 ? saved.unlocked : 0,
      stars: Array.isArray(saved.stars) ? saved.stars.map(s => Number(s) || 0) : [],
    };
  } catch {
    return fresh;
  }
}

function saveProgress(name, progress) {
  writeValue(playerKey(name), JSON.stringify(progress));
}

function loadLastPlayer() {
  return readValue(LAST_PLAYER_KEY) || "";
}

function saveLastPlayer(name) {
  writeValue(LAST_PLAYER_KEY, name.trim());
}
