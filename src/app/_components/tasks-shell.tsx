import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";
import { taskSectionHref } from "@/lib/task-filters";
import styles from "../page.module.css";

export function TasksShell({ children, archived = false, today = false, query, areasDisabled, onManageAreas, settingsPage = false, onNavigate }: {
  children: ReactNode; archived?: boolean; today?: boolean; query: string; areasDisabled: boolean; onManageAreas: (opener: HTMLButtonElement) => void;
  settingsPage?: boolean; onNavigate?: (href: string) => void;
}) {
  const currentHref = taskSectionHref(new URLSearchParams(query), false);
  const archiveHref = taskSectionHref(new URLSearchParams(query), true);
  const todayHref = taskSectionHref(new URLSearchParams(query), "today");
  const settingsHref = `/settings${query ? `?${query}` : ""}`;
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (document.querySelector("dialog[open]")) { event.preventDefault(); return; }
    if (onNavigate) { event.preventDefault(); onNavigate(href); }
    else if (href === settingsHref && areasDisabled) event.preventDefault();
  }
  return (
    <div className={`${styles.shell} ${settingsPage ? "" : styles.tasksShell}`}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href={currentHref} scroll={false} onClick={(e) => navigate(e, currentHref)}>PersonalPlatform</Link>
        <nav aria-label="Основна навігація">
          <Link className={styles.navItem} href={currentHref} scroll={false} onClick={(e) => navigate(e, currentHref)} aria-current={!settingsPage && !archived && !today ? "page" : undefined}>
            <span aria-hidden="true">✓</span> Поточні задачі
          </Link>
          <Link className={styles.navItem} href={todayHref} scroll={false} onClick={(e) => navigate(e, todayHref)} aria-current={!settingsPage && today ? "page" : undefined}>
            <span aria-hidden="true">☀</span> Сьогодні
          </Link>
          <Link className={styles.navItem} href={archiveHref} scroll={false} onClick={(e) => navigate(e, archiveHref)} aria-current={!settingsPage && archived ? "page" : undefined}>
            <span aria-hidden="true">▣</span> Архів
          </Link>
          <button type="button" className={`${styles.navItem} ${styles.navButton}`} aria-disabled={areasDisabled} onClick={(event) => { if (!areasDisabled) onManageAreas(event.currentTarget); }}>Сфери</button>
          <Link className={styles.navItem} href={settingsHref} scroll={false} aria-current={settingsPage ? "page" : undefined} aria-disabled={!settingsPage && areasDisabled} onClick={(e) => navigate(e, settingsHref)}>Налаштування</Link>
        </nav>
      </aside>
      <main className={`${styles.main} ${settingsPage ? "" : styles.tasksMain}`}>{children}</main>
    </div>
  );
}
