import type { ReactNode } from "react";
import { SettingsProvider } from "../modules/settings/preferences";
import { AreasProvider } from "../entities/areas/ui";
import { HistoryTraversalProvider } from "../shared/navigation/use-history-traversal-guard";
import { AppAccessProvider } from "./access/ui/app-access";

// Server composition: each existing client provider keeps its own boundary.
export function ApplicationProviders({ children }: { children: ReactNode }) {
  return <HistoryTraversalProvider><SettingsProvider><AppAccessProvider><AreasProvider>{children}</AreasProvider></AppAccessProvider></SettingsProvider></HistoryTraversalProvider>;
}
