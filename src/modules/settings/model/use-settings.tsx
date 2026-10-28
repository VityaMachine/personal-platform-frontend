"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createSettingsStore } from "@/modules/settings/model/settings-store";
import { browserSettingsStorage, type SettingsStorage } from "@/modules/settings/model/settings-storage";
import { applyTheme } from "@/modules/settings/model/theme";

const SettingsContext = createContext<ReturnType<typeof createSettingsStore> | null>(null);

export function SettingsProvider({ children, storage = browserSettingsStorage }: { children: ReactNode; storage?: SettingsStorage }) {
  const [store] = useState(() => createSettingsStore(storage));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => { if (snapshot.ready) applyTheme(snapshot.settings.theme); }, [snapshot.ready, snapshot.settings.theme]);
  return <SettingsContext.Provider value={store}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const store = useContext(SettingsContext);
  if (!store) throw new Error("SettingsProvider is required");
  return { ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot), save: store.save };
}
