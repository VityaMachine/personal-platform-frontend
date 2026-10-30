import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  today: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
  current: <><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  backlog: <><rect x="4" y="7" width="16" height="14" rx="2" /><path d="M3 3h18v4H3zm7 8h4" /></>,
  archive: <><rect x="4" y="7" width="16" height="14" rx="2" /><path d="M3 3h18v4H3zm9 7v6m-3-3 3 3 3-3" /></>,
  routines: <><path d="M20 4v6h-6M4 20v-6h6M20 10a8 8 0 0 0-14-4M4 14a8 8 0 0 0 14 4" /></>,
  tasks: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m7 12 3 3 7-7" /></>,
  areas: <><circle cx="12" cy="12" r="9" /><path d="m14 6-5 4-3 7m3-7 7 5 3-5M9 10l5-4m2 9-2 4" /></>,
  settings: <><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" /><circle cx="12" cy="12" r="3" /></>,
  logout: <><path d="M10 4H5v16h5m4-12 4 4-4 4m-5-4h12" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
};

export function ShellIcon({ name, className }: { name: string; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function PlatformMark() {
  return <svg width="30" height="36" viewBox="0 0 30 36" fill="none" aria-hidden="true" focusable="false">
    <path d="m15 1 14 8v16L15 17 1 25V9Z" fill="currentColor" opacity=".85" />
    <path d="m1 25 14-8v18L1 27Zm14-8 14-8L15 1Z" fill="currentColor" />
    <path d="M15 1v16M1 9l28 16M1 25l28-16" stroke="var(--shell-surface)" strokeWidth="1.2" />
  </svg>;
}
