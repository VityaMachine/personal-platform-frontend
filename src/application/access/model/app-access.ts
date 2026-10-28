export const APP_ACCESS_KEY = "personal-platform.access-password";

type StorageAdapter = {
  read: () => string | null;
  write: (password: string) => void;
  remove: () => void;
  subscribe: (check: () => void) => () => void;
};

export const browserAccessStorage: StorageAdapter = {
  read: () => window.localStorage.getItem(APP_ACCESS_KEY),
  write: (password) => window.localStorage.setItem(APP_ACCESS_KEY, password),
  remove: () => window.localStorage.removeItem(APP_ACCESS_KEY),
  subscribe(check) {
    const listener = (event: StorageEvent) => {
      if (event.key !== null && event.key !== APP_ACCESS_KEY) return;
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { /* Recheck unavailable storage. */ }
      check();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  },
};

export function createAppAccessStore(expected: string | undefined, storage: StorageAdapter) {
  const server = { ready: false, authorized: false, configured: Boolean(expected), storageAvailable: true };
  let snapshot = server;
  let started = false;
  let stop: (() => void) | undefined;
  const listeners = new Set<() => void>();
  function publish(authorized: boolean, storageAvailable: boolean) {
    snapshot = { ...server, ready: true, authorized, storageAvailable };
    listeners.forEach((listener) => listener());
  }
  function check() {
    try { publish(Boolean(expected) && storage.read() === expected, true); }
    catch { publish(false, false); }
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => server,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!started) { started = true; queueMicrotask(check); }
      stop ??= storage.subscribe(check);
      return () => { listeners.delete(listener); if (!listeners.size) { stop?.(); stop = undefined; } };
    },
    login(password: string) {
      if (!expected || password !== expected) return false;
      let available = true;
      try { storage.write(password); } catch { available = false; }
      publish(true, available);
      return true;
    },
    logout() {
      let available = true;
      try { storage.remove(); } catch { available = false; }
      publish(false, available);
    },
  };
}
