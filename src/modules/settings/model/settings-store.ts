import { decodeSettings, defaultSettings, encodeSettings, normalizeSettings, type Settings } from "./settings";
import type { SettingsStorage } from "./settings-storage";

export function createSettingsStore(storage: SettingsStorage) {
  const server = { settings: defaultSettings(), ready: false, storageAvailable: true, revision: 0 };
  let snapshot = server;
  let defaults = server.settings;
  let stop: (() => void) | undefined;
  let initializing = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => server,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!stop) {
        if (!snapshot.ready && !initializing) {
          initializing = true;
          let zone = "UTC";
          try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* UTC fallback */ }
          defaults = defaultSettings(zone);
          const revision = snapshot.revision;
          // Accept asynchronous adapters too; a future remote store needs no UI changes.
          void Promise.resolve().then(() => storage.read()).catch(() => ({ raw: null, available: false })).then((result) => {
            if (snapshot.revision !== revision) return;
            snapshot = { settings: decodeSettings(result.raw, defaults), ready: true, storageAvailable: result.available, revision: revision + 1 };
            emit();
          });
        }
        stop = storage.subscribe((raw) => {
          const settings = decodeSettings(raw, defaults);
          if (encodeSettings(settings) === encodeSettings(snapshot.settings)) return;
          snapshot = { ...snapshot, ready: true, settings, revision: snapshot.revision + 1 };
          emit(); // External changes never write back to storage.
        });
      }
      return () => { listeners.delete(listener); if (!listeners.size) { stop?.(); stop = undefined; } };
    },
    async save(value: Settings) {
      const settings = normalizeSettings(value, defaults);
      let storageAvailable = false;
      try { storageAvailable = await storage.write(encodeSettings(settings)); } catch { /* Keep session values on persistence failure. */ }
      snapshot = { settings, ready: true, storageAvailable, revision: snapshot.revision + 1 };
      emit();
      return storageAvailable;
    },
  };
}
