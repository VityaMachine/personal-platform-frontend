import type { ReactNode } from "react";
import Link from "next/link";
import { taskSectionHref } from "@/lib/task-filters";
import styles from "../page.module.css";

export function TasksShell({ children, archived = false, query, areasDisabled, onManageAreas }: {
  children: ReactNode; archived?: boolean; query: string; areasDisabled: boolean; onManageAreas: (opener: HTMLButtonElement) => void;
}) {
  const currentHref = taskSectionHref(new URLSearchParams(query), false);
  const archiveHref = taskSectionHref(new URLSearchParams(query), true);
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href={currentHref} scroll={false}>PersonalPlatform</Link>
        <nav aria-label="Основна навігація">
          <Link className={styles.navItem} href={currentHref} scroll={false} aria-current={!archived ? "page" : undefined}>
            <span aria-hidden="true">✓</span> Поточні задачі
          </Link>
          <Link className={styles.navItem} href={archiveHref} scroll={false} aria-current={archived ? "page" : undefined}>
            <span aria-hidden="true">▣</span> Архів
          </Link>
          <button type="button" className={`${styles.navItem} ${styles.navButton}`} aria-disabled={areasDisabled} onClick={(event) => { if (!areasDisabled) onManageAreas(event.currentTarget); }}>Сфери</button>
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
