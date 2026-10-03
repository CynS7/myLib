// Dünne Schicht über dem Gerätespeicher. Fehler (z. B. privater Modus) werden abgefangen.
// Für Tests kann statt localStorage ein eigenes Objekt mit getItem/setItem übergeben werden.

export function createStorage(backend = globalThis.localStorage) {
  return {
    getJson(key, fallback) {
      try {
        const raw = backend.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    setJson(key, value) {
      try {
        backend.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    getString(key) {
      try {
        return backend.getItem(key) || '';
      } catch {
        return '';
      }
    },
    setString(key, value) {
      try {
        backend.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function memoryBackend() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}
