// localStorage that never takes the app down. Storage can be unavailable
// (private browsing, blocked site data, sandboxed previews) and then even
// *reading* it throws. Every read falls back, every write is best-effort:
// the app keeps working for the session, it just won't remember.

function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readString(key, fallback = null) {
  try {
    const value = store()?.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function readJson(key, fallback) {
  const raw = readString(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeString(key, value) {
  try {
    store()?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function writeJson(key, value) {
  return writeString(key, JSON.stringify(value));
}
