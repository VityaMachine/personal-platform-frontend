"use client";

import { useSyncExternalStore } from "react";
import styles from "./today.module.css";

function subscribe(notify: () => void) {
  const timer = window.setInterval(notify, 30_000);
  window.addEventListener("focus", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", notify);
    document.removeEventListener("visibilitychange", notify);
  };
}

export function TodayDate({ timeZone }: { timeZone: string }) {
  const day = useSyncExternalStore(subscribe,
    () => new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    () => "");
  return <p className={styles.date}><time dateTime={day || undefined}>{day ? new Intl.DateTimeFormat("uk-UA", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(day + "T12:00:00Z")) : "Поточна дата…"}</time></p>;
}
