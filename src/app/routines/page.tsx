"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Routine } from "@/lib/routine-types";
import { getRoutine, routineError } from "@/lib/routines";
import { TasksShell } from "../_components/tasks-shell";
import { AreasModal } from "../_components/areas-modal";
import { useAreas } from "../_hooks/use-areas";
import { useOpenDialog } from "../_hooks/use-open-dialog";
import { useRoutines } from "../_hooks/use-routines";
import { useSettings } from "../_hooks/use-settings";
import { CreateRoutineModal } from "./create-routine-modal";
import { RoutineFormModal } from "./routine-form-modal";
import { RoutineDetailsModal } from "./routine-details-modal";
import { GenerateRoutineDialog } from "./generate-routine-dialog";
import { DeleteRoutineDialog } from "./delete-routine-dialog";
import { RoutineFacts } from "./routine-facts";
import shared from "../page.module.css";
import styles from "./routines.module.css";

export default function RoutinesPage() {
  return <Suspense fallback={<p role="status">Завантаження повторюваних задач…</p>}><RoutinesScreen /></Suspense>;
}
function RoutinesScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const areas = useAreas();
  const preferences = useSettings();
  const dialogOpen = useOpenDialog();
  const modalLock = useRef(false);
  const editRequest = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<{ id: string; opener: HTMLButtonElement; replacement?: Routine } | null>(null);
  const [areasOpener, setAreasOpener] = useState<HTMLButtonElement | null>(null);
  const [createOpener, setCreateOpener] = useState<HTMLButtonElement | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ routine: Routine; opener: HTMLButtonElement } | null>(null);
  const [generation, setGeneration] = useState<{ routine: Routine; opener: HTMLButtonElement } | null>(null);
  const [deleting, setDeleting] = useState<{ routine: Routine; opener: HTMLButtonElement } | null>(null);
  const [editLoad, setEditLoad] = useState<{ id: string; pending: boolean; error?: string } | null>(null);
  const [notice, setNotice] = useState("");
  const directory = useRoutines((routine) => setSelected((previous) => previous?.id === routine.id ? { ...previous, replacement: routine } : previous));
  useEffect(() => () => editRequest.current?.abort(), []);
  async function beginEdit(routine: Routine, opener: HTMLButtonElement) {
    if (directory.isLocked(routine.id) || modalLock.current || document.querySelector("dialog[open]")) return;
    modalLock.current = true; setNotice("");
    const controller = new AbortController(); editRequest.current = controller;
    setEditLoad({ id: routine.id, pending: true });
    try {
      const fresh = await getRoutine(routine.id, controller.signal);
      if (!controller.signal.aborted && editRequest.current === controller) {
        setEditing({ routine: fresh, opener }); setEditLoad({ id: routine.id, pending: false });
      }
    } catch (error) {
      if (!controller.signal.aborted && editRequest.current === controller) {
        modalLock.current = false; setEditLoad({ id: routine.id, pending: false, error: routineError(error) });
        requestAnimationFrame(() => { if (opener.isConnected && !document.querySelector("dialog[open]")) opener.focus(); });
      }
    } finally { if (editRequest.current === controller) editRequest.current = null; }
  }
  return <TasksShell routinesPage query={params.toString()} areasDisabled={directory.pending || creating || dialogOpen || Boolean(editLoad?.pending)} onNavigate={(href) => {
    if (!directory.pending && !creating && !modalLock.current && !document.querySelector("dialog[open]")) router.push(href, { scroll: false });
  }} onManageAreas={(opener) => {
    if (!directory.pending && !modalLock.current && !document.querySelector("dialog[open]")) { modalLock.current = true; areas.reload(); setAreasOpener(opener); }
  }}>
    <div className={shared.tasksToolbar}>
      <header className={shared.header}>
        <h1 ref={headingRef} tabIndex={-1} id="routines-heading" className={shared.title}>Повторювані задачі</h1>
        <div className={shared.taskHeaderActions}>
          <button type="button" className={shared.secondaryButton} disabled={directory.loading || directory.pending || dialogOpen || Boolean(editLoad?.pending) || generation !== null} onClick={directory.reload}>Оновити список</button>
          <button type="button" className={shared.primaryButton} disabled={!preferences.ready || directory.loading || directory.pending || dialogOpen || Boolean(editLoad?.pending)} onClick={(event) => {
            if (!modalLock.current && !document.querySelector("dialog[open]")) { modalLock.current = true; setNotice(""); setCreateOpener(event.currentTarget); }
          }}>Нове повторення</button>
        </div>
      </header>
      <p className={styles.hint}>Шаблони повторень. «Активний» означає відсутність паузи, а не гарантію майбутніх виконань.</p>
      {notice && <p role="status" className={shared.notice}>{notice}</p>}
    </div>
    <section className={shared.taskScroll} aria-labelledby="routines-heading" aria-busy={directory.loading} tabIndex={0}>
      {directory.loading && <p role="status">Завантаження повторюваних задач…</p>}
      {directory.error && <div role="alert" className={shared.error}><p>{directory.error}</p>
        <button type="button" className={shared.secondaryButton} disabled={directory.pending} onClick={directory.reload}>Повторити завантаження</button>
      </div>}
      {!directory.loading && !directory.error && directory.routines.length === 0 && <div className={shared.empty}>
        <h2>Повторюваних задач поки немає</h2><p>Збережені шаблони з’являться тут.</p>
      </div>}
      <ul className={styles.list}>{directory.routines.map((routine) => {
        const state = directory.states[routine.id];
        const editBusy = editing?.routine.id === routine.id || (editLoad?.id === routine.id && editLoad.pending) || generation?.routine.id === routine.id || deleting?.routine.id === routine.id;
        return <li key={routine.id} className={styles.card} aria-busy={Boolean(state?.pending || editBusy)}>
          <h2>{routine.title}</h2>
          <RoutineFacts routine={routine} />
          <div className={styles.actions}>
            <button type="button" className={shared.secondaryButton} disabled={Boolean(state?.pending || editBusy)} aria-label={`Деталі: ${routine.title}`} onClick={(event) => {
              if (!directory.isLocked(routine.id) && !modalLock.current && !document.querySelector("dialog[open]")) { modalLock.current = true; setSelected({ id: routine.id, opener: event.currentTarget }); }
            }}>Деталі</button>
            <button type="button" className={shared.secondaryButton} disabled={Boolean(state?.pending || editBusy)} aria-label={`Редагувати: ${routine.title}`} onClick={(event) => void beginEdit(routine, event.currentTarget)}>
              {editLoad?.id === routine.id && editLoad.pending ? "Завантаження…" : "Редагувати"}
            </button>
            <button type="button" className={shared.secondaryButton} disabled={Boolean(state?.pending || editBusy || routine.pausedAt)}
              aria-label={`Створити задачі: ${routine.title}`} aria-describedby={routine.pausedAt ? `generate-paused-${routine.id}` : undefined} onClick={(event) => {
                if (routine.pausedAt === null && !directory.isLocked(routine.id) && !modalLock.current && !document.querySelector("dialog[open]")) {
                  modalLock.current = true; setNotice(""); setGeneration({ routine, opener: event.currentTarget });
                }
              }}>Створити задачі</button>
            <button type="button" className={shared.secondaryButton} disabled={Boolean(state?.pending || editBusy)} aria-label={`${routine.pausedAt ? "Відновити" : "Призупинити"}: ${routine.title}`} onClick={() => { if (!modalLock.current) void directory.toggle(routine); }}>
              {state?.pending ? "Збереження…" : routine.pausedAt ? "Відновити" : "Призупинити"}
            </button>
            <button type="button" className={shared.deleteButton} disabled={Boolean(state?.pending || editBusy)} aria-label={`Видалити повторення: ${routine.title}`} onClick={(event) => {
              if (!directory.isLocked(routine.id) && !modalLock.current && !document.querySelector("dialog[open]")) {
                modalLock.current = true; setNotice(""); setDeleting({ routine, opener: event.currentTarget });
              }
            }}>Видалити</button>
          </div>
          {routine.pausedAt && <p id={`generate-paused-${routine.id}`} className={styles.hint}>Щоб створити задачі, спочатку відновіть повторення з паузи.</p>}
          {state?.error && <p role="alert" className={shared.fieldError}>{state.error}</p>}
          {state?.notice && <p role="status" className={shared.notice}>{state.notice}</p>}
          {editLoad?.id === routine.id && editLoad.error && <p role="alert" className={shared.fieldError}>{editLoad.error}</p>}
        </li>;
      })}</ul>
    </section>
    {selected && <RoutineDetailsModal key={selected.id} routineId={selected.id} replacement={selected.replacement} opener={selected.opener}
      pending={Boolean(directory.states[selected.id]?.pending)} error={directory.states[selected.id]?.error} notice={directory.states[selected.id]?.notice}
      onToggle={(routine) => void directory.toggle(routine)} onClose={() => { modalLock.current = false; setSelected(null); }} />}
    {areasOpener && <AreasModal opener={areasOpener} onClose={() => { modalLock.current = false; setAreasOpener(null); directory.reload(); }} tasksLoading={false} tasksError={null} reloadTasks={directory.reload} />}
    {createOpener && <CreateRoutineModal opener={createOpener} timezone={preferences.settings.timeZone} onSubmittingChange={setCreating}
      onClose={() => { modalLock.current = false; setCreateOpener(null); }}
      onCreated={(routine) => { directory.addCreated(routine); setNotice("Шаблон повторення створено"); modalLock.current = false; setCreateOpener(null); }} />}
    {editing && <RoutineFormModal key={editing.routine.id} opener={editing.opener} initialRoutine={editing.routine} timezone={editing.routine.timezone} onSubmittingChange={setCreating}
      onClose={() => { modalLock.current = false; setEditing(null); }}
      onSaved={(routine) => { editRequest.current?.abort(); directory.commitUpdated(routine); setNotice("Шаблон повторення оновлено"); modalLock.current = false; setEditing(null); }} />}
    {generation && <GenerateRoutineDialog key={generation.routine.id} routine={generation.routine} opener={generation.opener} onSubmittingChange={setCreating} navigationDisabled={directory.pending}
      onClose={() => { modalLock.current = false; setGeneration(null); }}
      onCurrentTasks={() => { modalLock.current = false; setGeneration(null); router.push("/", { scroll: false }); }} />}
    {deleting && <DeleteRoutineDialog key={deleting.routine.id} title={deleting.routine.title} opener={deleting.opener} fallbackFocusRef={headingRef}
      onConfirm={() => directory.remove(deleting.routine.id)} onCheck={() => directory.checkRemoval(deleting.routine.id)}
      onClose={() => { modalLock.current = false; setDeleting(null); }}
      onDeleted={() => { modalLock.current = false; setDeleting(null); setNotice("Шаблон повторення видалено"); }} />}
  </TasksShell>;
}
