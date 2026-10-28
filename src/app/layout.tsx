import type { Metadata } from "next";
import "./globals.css";
import { ApplicationProviders } from "../application/providers";
import { themeBootstrap } from "@/modules/settings/theme";

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
      <body><ApplicationProviders>{children}</ApplicationProviders></body>
    </html>
  );
}
