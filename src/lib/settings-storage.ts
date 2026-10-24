import { SETTINGS_KEY } from "./settings";

/** Replace this adapter with an API-backed store without changing consumers. */
export interface SettingsStorage {
  read(): { raw: string | null; available: boolean } | Promise<{ raw: string | null; available: boolean }>;
  write(raw: string): boolean | Promise<boolean>;
  subscribe(listener: (raw: string | null) => void): () => void;
}

export const browserSettingsStorage: SettingsStorage = {
  read() {
    try { return { raw: window.localStorage.getItem(SETTINGS_KEY), available: true }; }
    catch { return { raw: null, available: false }; }
  },
  write(raw) {
    try { window.localStorage.setItem(SETTINGS_KEY, raw); return true; } catch { return false; }
  },
  subscribe(listener) {
    const receive = (event: StorageEvent) => {
      try {
        if ((event.key === SETTINGS_KEY || event.key === null) && event.storageArea === window.localStorage) listener(event.newValue);
      } catch { /* Storage access can be disabled after mounting. */ }
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  },
};
