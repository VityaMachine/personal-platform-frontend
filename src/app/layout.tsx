import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
