"use client";

import { Suspense } from "react";
import { SettingsScreen } from "./settings-screen";

export default function SettingsPage() {
  return <Suspense fallback={<p role="status">Завантаження налаштувань…</p>}><SettingsScreen /></Suspense>;
}
