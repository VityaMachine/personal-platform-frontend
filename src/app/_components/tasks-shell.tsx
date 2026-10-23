import type { ReactNode } from "react";
import Link from "next/link";
import styles from "../page.module.css";

export function TasksShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">PersonalPlatform</Link>
        <nav aria-label="Основна навігація">
          <Link className={styles.navItem} href="/" aria-current="page">
            <span aria-hidden="true">✓</span> Поточні задачі
          </Link>
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
