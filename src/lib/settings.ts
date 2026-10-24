export const SETTINGS_VERSION = 1;
export const SETTINGS_KEY = "personal-platform.settings";
export type Theme = "system" | "light" | "dark";
export type Settings = {
  timeZone: string;
  language: "uk";
  theme: Theme;
  todayOverdueMode: "none" | "limited" | "all";
  todayOverdueDays: number;
};

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || /^[+-]/.test(value)) return false;
  try { new Intl.DateTimeFormat("uk", { timeZone: value }); return true; } catch { return false; }
}

export function defaultSettings(timeZone = "UTC"): Settings {
  return { timeZone: isTimeZone(timeZone) ? timeZone : "UTC", language: "uk", theme: "system", todayOverdueMode: "limited", todayOverdueDays: 3 };
}

export function normalizeSettings(value: unknown, defaults: Settings): Settings {
  const data = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    timeZone: isTimeZone(data.timeZone) ? data.timeZone : defaults.timeZone,
    language: "uk",
    theme: data.theme === "system" || data.theme === "light" || data.theme === "dark" ? data.theme : defaults.theme,
    todayOverdueMode: data.todayOverdueMode === "none" || data.todayOverdueMode === "limited" || data.todayOverdueMode === "all" ? data.todayOverdueMode : defaults.todayOverdueMode,
    todayOverdueDays: typeof data.todayOverdueDays === "number" && Number.isInteger(data.todayOverdueDays) && data.todayOverdueDays >= 1 && data.todayOverdueDays <= 365 ? data.todayOverdueDays : defaults.todayOverdueDays,
  };
}

export function decodeSettings(raw: string | null, defaults: Settings): Settings {
  try {
    const data: unknown = JSON.parse(raw ?? "null");
    return data && typeof data === "object" && "version" in data && data.version === SETTINGS_VERSION
      ? normalizeSettings(data, defaults) : defaults;
  } catch { return defaults; }
}

export function encodeSettings(settings: Settings): string {
  return JSON.stringify({ version: SETTINGS_VERSION, ...settings });
}

export function timeZoneOptions(current: string): string[] {
  const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set(["UTC", "Europe/Kyiv", current, ...supported])].sort();
}
