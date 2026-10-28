"use client";

import shellStyles from "./app-shell.module.css";

import { useState, type ReactNode, type MouseEvent } from "react";
import Link from "next/link";
import { taskNavigationHrefs, taskHref, cleanTaskQuery } from "@/modules/tasks/routes";
import { AreasModal, useAreas } from "../../entities/areas/ui";
import { LogoutButton } from "../access/ui/app-access";

export type AppNavigationItem = "current" | "today" | "backlog" | "archive" | "routines" | "settings";

export function AppShell({ children, activeItem, query, areasDisabled, logoutDisabled = areasDisabled, onManageAreas, onAreasClose, onNavigate }: {
  children: ReactNode; activeItem: AppNavigationItem; query: string; areasDisabled: boolean; logoutDisabled?: boolean;
  onManageAreas: (open: () => void) => void; onAreasClose?: () => void;
  onNavigate: (href: string, destination: AppNavigationItem) => void;
}) {
  const areas = useAreas();
  const [areasOpener, setAreasOpener] = useState<HTMLButtonElement | null>(null);
  const { current: currentHref, today: todayHref, backlog: backlogHref, archive: archiveHref } = taskNavigationHrefs(query);
  const routinesHref = taskHref("routines", query);
  const cleanedQuery = cleanTaskQuery(query);
  const settingsHref = `/settings${cleanedQuery ? `?${cleanedQuery}` : ""}`;
  const settingsPage = activeItem === "settings";
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string, destination: AppNavigationItem) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (areasOpener || document.querySelector("dialog[open]")) return;
    // The active screen also checks pending operations, locks and its own draft.
    onNavigate(href, destination);
  }
  return (
    <div className={`${shellStyles.shell} ${settingsPage ? "" : shellStyles.tasksShell}`}>
      <aside className={shellStyles.sidebar}>
        <Link className={shellStyles.brand} href={currentHref} scroll={false} onClick={(e) => navigate(e, currentHref, "current")}>PersonalPlatform</Link>
        <nav aria-label="Основна навігація">
          <Link className={shellStyles.navItem} href={currentHref} scroll={false} onClick={(e) => navigate(e, currentHref, "current")} aria-current={activeItem === "current" ? "page" : undefined}>
            <span aria-hidden="true">✓</span> Поточні задачі
          </Link>
          <Link className={shellStyles.navItem} href={todayHref} scroll={false} onClick={(e) => navigate(e, todayHref, "today")} aria-current={activeItem === "today" ? "page" : undefined}>
            <span aria-hidden="true">☀</span> Сьогодні
          </Link>
          <Link className={shellStyles.navItem} href={backlogHref} scroll={false} onClick={(e) => navigate(e, backlogHref, "backlog")} aria-current={activeItem === "backlog" ? "page" : undefined}>
            <span aria-hidden="true">≡</span> Беклог
          </Link>
          <Link className={shellStyles.navItem} href={archiveHref} scroll={false} onClick={(e) => navigate(e, archiveHref, "archive")} aria-current={activeItem === "archive" ? "page" : undefined}>
            <span aria-hidden="true">▣</span> Архів
          </Link>
          <Link className={shellStyles.navItem} href={routinesHref} scroll={false} onClick={(e) => navigate(e, routinesHref, "routines")} aria-current={activeItem === "routines" ? "page" : undefined}>
            <span aria-hidden="true">↻</span> Повторювані задачі
          </Link>
          <button type="button" className={`${shellStyles.navItem} ${shellStyles.navButton}`} aria-disabled={areasDisabled} onClick={(event) => { if (!areasDisabled && !areasOpener) { const opener = event.currentTarget; onManageAreas(() => { areas.reload(); setAreasOpener(opener); }); } }}>Сфери</button>
          <Link className={shellStyles.navItem} href={settingsHref} scroll={false} aria-current={settingsPage ? "page" : undefined} aria-disabled={!settingsPage && areasDisabled} onClick={(e) => navigate(e, settingsHref, "settings")}>Налаштування</Link>
          <LogoutButton disabled={logoutDisabled || areasOpener !== null} />
        </nav>
      </aside>
      <main className={`${shellStyles.main} ${settingsPage ? "" : shellStyles.tasksMain}`}>{children}
        {areasOpener && <AreasModal opener={areasOpener} onClose={() => { setAreasOpener(null); onAreasClose?.(); }} />}
      </main>
    </div>
  );
}
