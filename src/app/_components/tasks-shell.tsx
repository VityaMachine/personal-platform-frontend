import type { ReactNode } from "react";
import Link from "next/link";
import styles from "../page.module.css";

export function TasksShell({ children, archived = false }: { children: ReactNode; archived?: boolean }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">PersonalPlatform</Link>
        <nav aria-label="Основна навігація">
          <Link className={styles.navItem} href="/" aria-current={!archived ? "page" : undefined}>
            <span aria-hidden="true">✓</span> Поточні задачі
          </Link>
          <Link className={styles.navItem} href="/?archived=true" aria-current={archived ? "page" : undefined}>
            <span aria-hidden="true">▣</span> Архів
          </Link>
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
