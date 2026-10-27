// Saves each player's level, keyed by their name.
//
// Progress goes in a cookie. Chrome ignores cookies on pages opened straight
// from disk (file://), so when cookies don't stick we fall back to localStorage.

const COOKIE_DAYS = 365;
const KEY_PREFIX = "bottlePour_";
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

// Returns the saved level index for this player, or 0 for a new player.
function loadProgress(name) {
  const level = parseInt(readValue(playerKey(name)), 10);
  return Number.isInteger(level) && level >= 0 ? level : 0;
}

function saveProgress(name, level) {
  writeValue(playerKey(name), String(level));
}

function loadLastPlayer() {
  return readValue(LAST_PLAYER_KEY) || "";
}

function saveLastPlayer(name) {
  writeValue(LAST_PLAYER_KEY, name.trim());
}
