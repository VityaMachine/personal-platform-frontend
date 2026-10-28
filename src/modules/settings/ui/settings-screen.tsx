"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSettings } from "../model/use-settings";
import { useOpenDialog } from "../../../shared/hooks/use-open-dialog";
import { useHistoryTraversalGuard } from "../../../shared/navigation/use-history-traversal-guard";
import { AppShell } from "../../../application/shell/app-shell";
import { DiscardChangesDialog } from "../../../shared/ui/discard-changes-dialog";
import { isTimeZone, timeZoneOptions, type Settings } from "@/modules/settings/model/settings";
import styles from "../../../app/page.module.css";
import local from "./settings.module.css";

type Draft = Omit<Settings, "todayOverdueDays"> & { todayOverdueDays: string };
const draftOf = (settings: Settings): Draft => ({ ...settings, todayOverdueDays: String(settings.todayOverdueDays) });

export function SettingsScreen() {
  const settings = useSettings();
  return settings.ready ? <SettingsForm /> : <p role="status" className={styles.loading}>Завантаження налаштувань…</p>;
}

function SettingsForm() {
  const preferences = useSettings();
  const router = useRouter();
  const query = useSearchParams().toString();
  const dialogOpen = useOpenDialog();
  const [baseline, setBaseline] = useState(() => draftOf(preferences.settings));
  const [draft, setDraft] = useState(baseline);
  const [revision, setRevision] = useState(preferences.revision);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const cancelAction = useRef<(() => void) | null>(null);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const externalChange = revision !== preferences.revision;
  const [zones] = useState(() => timeZoneOptions(preferences.settings.timeZone));

  useHistoryTraversalGuard(dirty, (attempt) => {
    if (!request(attempt.leave, attempt.returnFocus)) return false;
    cancelAction.current = attempt.stay;
    return true;
  });

  // Adopt external values only when no local draft would be overwritten.
  if (externalChange && !dirty) {
    const next = draftOf(preferences.settings);
    setBaseline(next); setDraft(next); setRevision(preferences.revision); setErrors({});
  }

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);

  function request(action: () => void, focus?: HTMLElement | null) {
    if (inFlight.current || pendingAction.current || confirming || document.querySelector("dialog[open]")) return false;
    if (dirty) { pendingAction.current = action; setReturnFocus(focus ?? null); setConfirming(true); }
    else action();
    return true;
  }

  function change<K extends keyof Draft>(field: K, value: Draft[K]) {
    if (inFlight.current) return;
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined,
      ...(field === "todayOverdueMode" && value !== "limited" ? { todayOverdueDays: undefined } : {}),
    })); setNotice("");
  }

  function loadExternal() {
    const next = draftOf(preferences.settings);
    setBaseline(next); setDraft(next); setRevision(preferences.revision); setErrors({}); setNotice("Завантажено налаштування з іншої вкладки.");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialogOpen || inFlight.current) return;
    const nextErrors: typeof errors = {};
    if (!isTimeZone(draft.timeZone.trim())) nextErrors.timeZone = "Виберіть коректний часовий пояс IANA, наприклад Europe/Kyiv.";
    const days = Number(draft.todayOverdueDays);
    const validDays = draft.todayOverdueDays.trim() !== "" && Number.isInteger(days) && days >= 1 && days <= 365;
    if (draft.todayOverdueMode === "limited" && !validDays) nextErrors.todayOverdueDays = "Введіть ціле число від 1 до 365.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    const next: Settings = { ...draft, timeZone: draft.timeZone.trim(), todayOverdueDays: validDays ? days : preferences.settings.todayOverdueDays };
    inFlight.current = true; setSaving(true);
    const persisted = await preferences.save(next);
    inFlight.current = false; setSaving(false);
    const nextDraft = draftOf(next);
    setBaseline(nextDraft); setDraft(nextDraft);
    setNotice(persisted ? "Налаштування збережено в цьому браузері." : "Налаштування застосовано лише в поточній вкладці: сховище браузера недоступне.");
  }

  return <AppShell activeItem="settings" query={query} areasDisabled={dialogOpen || saving} logoutDisabled={dialogOpen || saving || confirming} onNavigate={(href) => {
    if (!href.startsWith("/settings")) request(() => router.push(href, { scroll: false }));
  }} onManageAreas={(open) => { request(open); }}>
    <header className={styles.header}><h1 className={styles.title}>Налаштування</h1></header>
    <div className={local.panel}>
      <p>Налаштування зберігаються в цьому браузері й поки не синхронізуються між пристроями.</p>
      {!preferences.storageAvailable && <p role="status" className={local.warning}>Сховище браузера недоступне. Зміни діятимуть лише в поточній вкладці та можуть зникнути після перезавантаження.</p>}
      {externalChange && dirty && !saving && <div role="status" className={local.warning}>
        <p>Налаштування змінено в іншій вкладці. Ваші незбережені дані залишилися у формі. Завантажте нові значення або натисніть «Зберегти», щоб застосувати власні.</p>
        <button type="button" className={styles.secondaryButton} onClick={loadExternal}>Завантажити нові значення</button>
      </div>}
      <form noValidate onSubmit={save} className={local.form} aria-busy={saving}>
        <fieldset disabled={saving} className={local.fields}>
          <legend className={local.srOnly}>Особисті налаштування</legend>
          <label className={styles.field} htmlFor="settings-zone">Часовий пояс
            <input id="settings-zone" list="settings-timezones" value={draft.timeZone} autoComplete="off" aria-invalid={Boolean(errors.timeZone)} aria-describedby="settings-zone-hint settings-zone-error" onChange={(e) => change("timeZone", e.target.value)} />
            <datalist id="settings-timezones">{[...new Set([...zones, preferences.settings.timeZone])].map((zone) => <option key={zone} value={zone} />)}</datalist>
            <span id="settings-zone-hint" className={styles.fieldHint}>Почніть вводити назву для пошуку. У цьому поясі показуються та вводяться дати задач.</span>
            <span id="settings-zone-error" className={styles.fieldError}>{errors.timeZone}</span>
          </label>
          <label className={styles.field} htmlFor="settings-language">Мова
            <select id="settings-language" value="uk" disabled aria-describedby="settings-language-hint"><option value="uk">Українська</option></select>
            <span id="settings-language-hint" className={styles.fieldHint}>Інші мови з’являться пізніше.</span>
          </label>
          <label className={styles.field} htmlFor="settings-theme">Тема
            <select id="settings-theme" value={draft.theme} onChange={(e) => change("theme", e.target.value as Settings["theme"])}>
              <option value="system">Системна</option><option value="light">Світла</option><option value="dark">Темна</option>
            </select>
          </label>
          <fieldset className={local.overdue}><legend>Прострочені задачі у «Сьогодні»</legend>
            <label className={styles.field} htmlFor="settings-overdue">Показувати прострочені задачі
              <select id="settings-overdue" value={draft.todayOverdueMode} onChange={(e) => change("todayOverdueMode", e.target.value as Settings["todayOverdueMode"])}>
                <option value="none">Не показувати</option><option value="limited">За останні N днів</option><option value="all">Показувати всі</option>
              </select>
            </label>
            <label className={styles.field} htmlFor="settings-days">Кількість попередніх календарних днів
              <input id="settings-days" type="number" min={1} max={365} step={1} disabled={draft.todayOverdueMode !== "limited"} value={draft.todayOverdueDays} aria-invalid={Boolean(errors.todayOverdueDays)} aria-describedby="settings-days-hint settings-days-error" onChange={(e) => change("todayOverdueDays", e.target.value)} />
              <span id="settings-days-error" className={styles.fieldError}>{errors.todayOverdueDays}</span>
            </label>
            <p id="settings-days-hint" className={styles.fieldHint}>Сьогодні входить завжди. Обмежений режим додає N попередніх календарних днів; «Не показувати» залишає лише сьогодні, «Показувати всі» додає всі попередні дні.</p>
          </fieldset>
          <div className={local.actions}><button type="submit" className={styles.primaryButton}>Зберегти</button>{dirty && <span className={styles.fieldHint}>Є незбережені зміни</span>}</div>
        </fieldset>
        {saving && <p role="status">Збереження налаштувань…</p>}
        <p role="status" className={styles.notice}>{notice}</p>
      </form>
    </div>
    {confirming && <DiscardChangesDialog returnFocus={returnFocus} continueLabel="Залишитися" discardLabel="Вийти без збереження" onContinue={() => {
      cancelAction.current?.(); cancelAction.current = null; pendingAction.current = null; setConfirming(false);
    }} onDiscard={() => {
      const action = pendingAction.current; pendingAction.current = null;
      cancelAction.current = null;
      setConfirming(false); setDraft(baseline); action?.();
    }} />}
  </AppShell>;
}
