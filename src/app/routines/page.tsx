"use client";
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Routine } from "@/lib/routine-types";
import { TasksShell } from "../_components/tasks-shell";
import { AreasModal } from "../_components/areas-modal";
import { useAreas } from "../_hooks/use-areas";
import { useOpenDialog } from "../_hooks/use-open-dialog";
import { useRoutines } from "../_hooks/use-routines";
import { useSettings } from "../_hooks/use-settings";
import { CreateRoutineModal } from "./create-routine-modal";
import { RoutineDetailsModal } from "./routine-details-modal";
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
  const [selected, setSelected] = useState<{ id: string; opener: HTMLButtonElement; replacement?: Routine } | null>(null);
  const [areasOpener, setAreasOpener] = useState<HTMLButtonElement | null>(null);
  const [createOpener, setCreateOpener] = useState<HTMLButtonElement | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const directory = useRoutines((routine) => setSelected((previous) => previous?.id === routine.id ? { ...previous, replacement: routine } : previous));
  return <TasksShell routinesPage query={params.toString()} areasDisabled={directory.pending || creating || dialogOpen} onNavigate={(href) => {
    if (!directory.pending && !creating && !modalLock.current && !document.querySelector("dialog[open]")) router.push(href, { scroll: false });
  }} onManageAreas={(opener) => {
    if (!directory.pending && !modalLock.current && !document.querySelector("dialog[open]")) { modalLock.current = true; areas.reload(); setAreasOpener(opener); }
  }}>
    <div className={shared.tasksToolbar}>
      <header className={shared.header}>
        <h1 id="routines-heading" className={shared.title}>Повторювані задачі</h1>
        <div className={shared.taskHeaderActions}>
          <button type="button" className={shared.secondaryButton} disabled={directory.loading || directory.pending || dialogOpen} onClick={directory.reload}>Оновити список</button>
          <button type="button" className={shared.primaryButton} disabled={!preferences.ready || directory.loading || directory.pending || dialogOpen} onClick={(event) => {
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
        return <li key={routine.id} className={styles.card} aria-busy={Boolean(state?.pending)}>
          <h2>{routine.title}</h2>
          <RoutineFacts routine={routine} />
          <div className={styles.actions}>
            <button type="button" className={shared.secondaryButton} disabled={Boolean(state?.pending)} aria-label={`Деталі: ${routine.title}`} onClick={(event) => {
              if (!modalLock.current && !document.querySelector("dialog[open]")) { modalLock.current = true; setSelected({ id: routine.id, opener: event.currentTarget }); }
            }}>Деталі</button>
            <button type="button" className={shared.secondaryButton} disabled={Boolean(state?.pending)} aria-label={`${routine.pausedAt ? "Відновити" : "Призупинити"}: ${routine.title}`} onClick={() => void directory.toggle(routine)}>
              {state?.pending ? "Збереження…" : routine.pausedAt ? "Відновити" : "Призупинити"}
            </button>
          </div>
          {state?.error && <p role="alert" className={shared.fieldError}>{state.error}</p>}
          {state?.notice && <p role="status" className={shared.notice}>{state.notice}</p>}
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
  </TasksShell>;
}
