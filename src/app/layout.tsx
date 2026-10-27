import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "./_hooks/use-settings";
import { AreasProvider } from "./_hooks/use-areas";
import { themeBootstrap } from "@/lib/theme";
import { HistoryTraversalProvider } from "./_hooks/use-history-traversal-guard";
import { AppAccessProvider } from "./_components/app-access";

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
