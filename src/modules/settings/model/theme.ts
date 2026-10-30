import type { Theme } from "./settings";
import { SETTINGS_KEY, SETTINGS_VERSION } from "./settings";

export const themeTokens = [
  "text", "page", "border", "surface", "accent", "nav",
  "muted", "border-soft", "shadow", "backdrop", "backdrop-nested", "surface-muted",
  "secondary", "danger", "danger-hover", "input-border", "input", "readonly",
  "error-bg", "placeholder", "accent-hover", "focus", "button-border", "notice",
  "error-border", "empty-border", "empty-icon", "card-border", "progress", "icon",
  "badge", "blue-bg", "blue", "select-border", "done-bg", "warning-bg",
  "warning", "cancel-bg", "icon-hover", "subtask-border", "subtask-bg", "timeline",
  "nested-border", "delete", "completed-bg", "on-accent",
  "shell-surface",
  "shell-page",
  "shell-text",
  "shell-accent",
  "shell-nav",
  "shell-border",
  "today-text",
  "today-surface",
  "today-secondary",
  "today-muted",
  "today-card-border",
  "today-accent",
  "today-accent-hover",
  "today-nav",
  "today-input",
  "today-input-border",
  "today-on-accent",
  "status-todo",
  "status-in-progress",
  "status-inactive",
  "status-done",
  "status-label",
  "summary-todo",
  "summary-progress",
  "summary-inactive",
  "summary-done",
  "summary-label",
  "summary-amber-label",
  "today-status-todo",
  "today-status-progress",
];
const styleId = "personal-theme-override";

function themeRule(theme: Theme): string {
  return theme === "system" ? "" : `:root:root { color-scheme: ${theme}; ${themeTokens.map((token) => `--${token}:var(--${theme}-${token});`).join("")} }`;
}

export function applyTheme(theme: Theme) {
  const sheet = (document.getElementById(styleId) as HTMLStyleElement | null)?.sheet;
  if (!sheet) return;
  while (sheet.cssRules.length) sheet.deleteRule(0);
  const rule = themeRule(theme);
  if (rule) sheet.insertRule(rule);
}

// CSSOM changes leave the server-rendered DOM intact during hydration. The
// blocking head script sets the palette before paint; system mode uses CSS media.
export const themeBootstrap = `(()=>{try{const s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"null");if(!s||s.version!==${SETTINGS_VERSION}||!["light","dark"].includes(s.theme))return;const sheet=document.getElementById(${JSON.stringify(styleId)}).sheet;sheet.insertRule(":root:root{color-scheme:"+s.theme+";"+${JSON.stringify(themeTokens)}.map(t=>"--"+t+":var(--"+s.theme+"-"+t+");").join("")+"}");}catch{}})();`;
