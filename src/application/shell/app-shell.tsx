"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { taskNavigationHrefs, taskHref, cleanTaskQuery } from "@/modules/tasks/routes";
import { AreasModal, useAreas } from "../../entities/areas/ui";
import { LogoutButton } from "../access/ui/app-access";
import styles from "./app-shell.module.css";

export type AppNavigationItem = "current" | "today" | "backlog" | "archive" | "routines" | "settings";
const mobileQuery = "(max-width: 760px)";
const subscribeMobile = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export function AppShell({ children, activeItem, query, areasDisabled, logoutDisabled = areasDisabled, onManageAreas, onAreasClose, onNavigate }: {
  children: ReactNode; activeItem: AppNavigationItem; query: string; areasDisabled: boolean; logoutDisabled?: boolean;
  onManageAreas: (open: () => void) => void; onAreasClose?: () => void;
  onNavigate: (href: string, destination: AppNavigationItem, accepted: () => void) => void;
}) {
  const areas = useAreas();
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const desktopAreas = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previousMobile, setPreviousMobile] = useState(mobile);
  if (previousMobile !== mobile) {
    setPreviousMobile(mobile);
    setMenuOpen(false);
  }
  const [expanded, setExpanded] = useState(activeItem !== "settings");
  const [areasOpener, setAreasOpener] = useState<HTMLButtonElement | null>(null);
  const settingsPage = activeItem === "settings";
  const hrefs = taskNavigationHrefs(query);
  const cleanedQuery = cleanTaskQuery(query);
  const settingsHref = `/settings${cleanedQuery ? `?${cleanedQuery}` : ""}`;
  const items: { key: AppNavigationItem; label: string; href: string }[] = [
    { key: "today", label: "Сьогодні", href: hrefs.today },
    { key: "current", label: "Поточні задачі", href: hrefs.current },
    { key: "backlog", label: "Беклог", href: hrefs.backlog },
    { key: "archive", label: "Архів", href: hrefs.archive },
    { key: "routines", label: "Повторювані задачі", href: taskHref("routines", query) },
  ];
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string, destination: AppNavigationItem) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (areasOpener || document.querySelector("dialog[open]")) return;
    onNavigate(href, destination, closeMenu);
  }
  const navigation = <nav className={styles.navigation} aria-label="Основна навігація">
    <div className={styles.modules}>
      <button type="button" className={`${styles.navItem} ${styles.navButton} ${styles.moduleHeading}`}
        aria-expanded={expanded} aria-controls="tasks-navigation" onClick={() => setExpanded(!expanded)}>
        Задачі <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
      <div id="tasks-navigation" className={styles.submenu} hidden={!expanded}>
        {items.map(({ key, label, href }) => <Link key={key} className={styles.navItem} href={href} scroll={false}
          onClick={(event) => navigate(event, href, key)} aria-current={activeItem === key ? "page" : undefined}>{label}</Link>)}
      </div>
      <button ref={mobile ? undefined : desktopAreas} type="button" className={`${styles.navItem} ${styles.navButton}`} aria-disabled={areasDisabled}
        onClick={(event) => {
          if (areasDisabled || areasOpener) return;
          const opener = mobile ? menuButton.current : event.currentTarget;
          onManageAreas(() => {
            flushSync(closeMenu);
            areas.reload();
            setAreasOpener(opener);
          });
        }}>Сфери</button>
    </div>
    <div className={styles.navFooter}>
      <Link className={styles.navItem} href={settingsHref} scroll={false} aria-current={settingsPage ? "page" : undefined}
        aria-disabled={!settingsPage && areasDisabled} onClick={(event) => {
          if (settingsPage) { event.preventDefault(); closeMenu(); }
          else navigate(event, settingsHref, "settings");
        }}>Налаштування</Link>
      <LogoutButton disabled={logoutDisabled || areasOpener !== null} />
    </div>
  </nav>;
  const brand = <Link className={styles.brand} href={hrefs.current} scroll={false}
    onClick={(event) => navigate(event, hrefs.current, "current")}>Personal Platform</Link>;

  return <div className={`${styles.shell} ${settingsPage ? "" : styles.tasksShell}`}>
    {mobile ? <header className={styles.mobileHeader} inert={menuOpen}>
      {brand}<button ref={menuButton} type="button" className={styles.menuToggle} aria-label="Відкрити меню"
        aria-expanded={menuOpen} aria-controls={menuOpen ? "mobile-navigation" : undefined}
        onClick={() => setMenuOpen(true)}>☰</button>
    </header> : <aside className={styles.sidebar}>{brand}{navigation}</aside>}
    {mobile && menuOpen && <MobileMenu onClose={closeMenu} opener={menuButton}>{navigation}</MobileMenu>}
    <main inert={mobile && menuOpen} className={`${styles.main} ${settingsPage ? "" : styles.tasksMain}`}>{children}</main>
    {areasOpener && <AreasModal opener={areasOpener} onClose={() => {
      setAreasOpener(null); onAreasClose?.();
      requestAnimationFrame(() => (window.matchMedia(mobileQuery).matches ? menuButton.current : desktopAreas.current)?.focus());
    }} />}
  </div>;
}

function MobileMenu({ children, onClose, opener }: {
  children: ReactNode; onClose: () => void; opener: React.RefObject<HTMLButtonElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = opener.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function trap(event: KeyboardEvent) {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? [])].filter(e => e.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
      else if (!document.querySelector("dialog[open]")) document.querySelector<HTMLButtonElement>('button[aria-controls="tasks-navigation"]')?.focus();
    };
  }, [opener, onClose]);
  return <div className={styles.backdrop} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} id="mobile-navigation" className={styles.drawer} role="dialog" aria-modal="true" aria-label="Меню Personal Platform">
      <div className={styles.drawerHeader}><strong>Personal Platform</strong>
        <button className={styles.menuToggle} type="button" aria-label="Закрити меню" onClick={onClose}>×</button>
      </div>
      {children}
    </div>
  </div>;
}
