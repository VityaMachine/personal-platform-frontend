import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "../modules/settings/preferences";
import { AreasProvider } from "../entities/areas/ui";
import { themeBootstrap } from "@/modules/settings/theme";
import { HistoryTraversalProvider } from "../shared/navigation/use-history-traversal-guard";
import { AppAccessProvider } from "../application/access/ui/app-access";

export const metadata: Metadata = {
  title: "Мої задачі",
  description: "Майбутній таскменеджер для ваших щоденних справ.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <head>
        <style id="personal-theme-override" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body><HistoryTraversalProvider><SettingsProvider><AppAccessProvider><AreasProvider>{children}</AreasProvider></AppAccessProvider></SettingsProvider></HistoryTraversalProvider></body>
    </html>
  );
}
