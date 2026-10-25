"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTaskList } from "./_hooks/use-task-list";
import { useAreas } from "./_hooks/use-areas";
import { AreasModal } from "./_components/areas-modal";
import { useOpenDialog } from "./_hooks/use-open-dialog";
import { useTaskMutations } from "./_hooks/use-task-mutations";
import { useTaskFilters } from "./_hooks/use-task-filters";
import { taskSection, taskInSection } from "@/lib/task-context";
import { groupTaskList, selectTasks } from "@/lib/task-filters";
import { TaskStatusSummary } from "./_components/task-status-summary";
import { TaskFiltersPanel } from "./_components/task-filters-panel";
import { CreateTaskModal } from "./_components/create-task-modal";
import { TaskCard } from "./_components/task-card";
import { TasksShell } from "./_components/tasks-shell";
import styles from "./page.module.css";

export default function Home() {
  return <Suspense fallback={<p role="status" className={styles.loading}>Завантаження задач…</p>}><TasksPage /></Suspense>;
}

function TasksPage() {
  const searchParams = useSearchParams();
  const requestedSection = taskSection(searchParams);
  const [section, setSection] = useState(requestedSection);
  const archived = section === "archive";
  const today = section === "today";
  const areas = useAreas();
  const { tasks, setTasks, loading, error: loadError, reload, context, scopeKey } = useTaskList(section, areas.taskRevision);
  const [areasOpener, setAreasOpener] = useState<HTMLButtonElement | null>(null);
  const dialogOpen = useOpenDialog();
  // Keep disclosure state separate from refreshed DTOs and keyed by task ID.
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const createScope = useRef(scopeKey);
  const busy = loading || pending !== null;
  const mutations = useTaskMutations(setTasks, busy, (id) => {
    setExpandedTaskIds((previous) => new Set(previous).add(id));
  }, { context, scopeKey, section, reload });
  const filtersBlocked = creating || dialogOpen || pending !== null || mutations.hasLockedTasks;
  const view = useTaskFilters(filtersBlocked);
  const selectedTasks = selectTasks(tasks, view.filters);
  // Retain modal owners if a context reload removes their task. They are
  // explicitly marked stale and released as soon as forms and locks close.
  const [owners, setOwners] = useState(tasks);
  const retainOwners = dialogOpen || mutations.hasLockedTasks;
  if (!retainOwners && !loading && owners !== tasks) setOwners(tasks);
  const retained = retainOwners ? selectTasks(owners, view.filters).filter((old) => !selectedTasks.some((task) => task.id === old.id)) : [];
  const shownTasks = [...selectedTasks, ...retained];

  // History can change behind a modal. Preserve its draft and parent locks
  // until the form closes and pending mutations finish.
  const navigationDeferred = requestedSection !== section;
  if (navigationDeferred && !creating && !dialogOpen && pending === null && !mutations.hasLockedTasks) {
    setSection(requestedSection);
    setNotice("");
  }

  return (
    <TasksShell archived={archived} today={today} query={searchParams.toString()} areasDisabled={busy || dialogOpen || mutations.hasLockedTasks} onManageAreas={(opener) => {
      if (!busy && !mutations.hasLockedTasks && !document.querySelector("dialog[open]")) {
        areas.reload(); setAreasOpener(opener);
      }
    }}>
      {areasOpener && <AreasModal opener={areasOpener} onClose={() => setAreasOpener(null)} tasksLoading={loading} tasksError={loadError} reloadTasks={reload} />}
      <div className={styles.tasksToolbar}>
        <header className={styles.header}>
          <div>
            <h1 id="tasks-heading" className={styles.title}>{archived ? "Архів" : today ? "Сьогодні" : "Поточні задачі"}</h1>
          </div>
          <div className={styles.taskHeaderActions}>
            <button type="button" className={styles.secondaryButton} disabled={busy || filtersBlocked} onClick={reload}>Оновити список</button>
            {!archived && <button ref={createButtonRef} className={styles.primaryButton} type="button" disabled={busy} onClick={() => setCreating(true)}>+ Нова задача</button>}
          </div>
        </header>

        {creating && <CreateTaskModal
          returnFocusRef={createButtonRef}
          onClose={() => setCreating(false)}
          onSubmittingChange={(submitting) => {
            setPending(submitting ? "create" : null);
            if (submitting) {
              createScope.current = scopeKey;
              setNotice("");
            }
          }}
          onCreated={(created, createdContext) => {
            const currentContext = createdContext === JSON.stringify(context);
            const belongs = taskInSection(created, section);
            if (currentContext && createScope.current === scopeKey && belongs) setTasks((previous) => [created, ...previous.filter((task) => task.id !== created.id)]);
            if (!currentContext || createScope.current !== scopeKey) reload();
            setNotice(today && (!currentContext || !belongs) ? "Задачу створено. Вона доступна в “Поточних задачах”" : selectTasks([created], view.filters).length ? "Задачу створено." : "Задачу створено. Поточні фільтри приховують її у списку.");
            setCreating(false);
          }}
        />}

        <div className={styles.feedback}>
          <p role="status" className={styles.notice}>{notice}</p>
          {retained.length > 0 && <p role="status" className={styles.notice}>Дані відкритої форми збережено. Її попередня картка тимчасово залишається до закриття форми або завершення оновлення; вона не є результатом актуального запиту.</p>}
          {(navigationDeferred || view.deferred) && <p role="status" className={styles.notice}>Перехід та зміну умов списку буде застосовано після закриття форми та завершення поточних змін.</p>}
        </div>

        <TaskStatusSummary tasks={tasks} loading={loading} error={Boolean(loadError)} />

        <TaskFiltersPanel filters={view.filters} onChange={view.change} onReset={view.reset} disabled={filtersBlocked}
          total={tasks.length} found={selectedTasks.length} loading={loading} error={Boolean(loadError)} />
      </div>

      <section className={styles.taskScroll} aria-labelledby="tasks-heading" aria-busy={loading} tabIndex={0}>
        {loadError && (
          <div role="alert" className={styles.error}>
            <p>{loadError}</p>
          </div>
        )}
        {loading && <p role="status" className={styles.loading}>Завантаження задач…</p>}
        {!loading && !loadError && tasks.length === 0 && retained.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">✓</span>
            <h3>{archived ? "Архів порожній" : today ? "На сьогодні задач немає" : "Тут починається ваш план"}</h3>
            {!today && <p>{archived ? "Архівовані задачі з’являться тут. Їх можна повернути до поточних задач." : "Натисніть «+ Нова задача», щоб додати першу справу."}</p>}
          </div>
        )}
        {!loading && !loadError && tasks.length > 0 && selectedTasks.length === 0 && retained.length === 0 && <div className={styles.empty}>
          <h3>За цими умовами задач не знайдено</h3>
          <p>Змініть умови або скиньте пошук, фільтри й сортування.</p>
          <button type="button" className={styles.secondaryButton} disabled={filtersBlocked} onClick={view.reset}>Скинути</button>
        </div>}
        {shownTasks.length > 0 && (
          <ul className={styles.taskList}>
            {/* Keep every keyed card under the same parent across group moves. */}
            {groupTaskList(shownTasks, section).flatMap((group) => [
              ...(group.title ? [<li key={`group-${group.id}`} className={styles.taskGroupHeading} role="presentation">
                <h2>{group.title} <span>({group.tasks.length})</span></h2>
              </li>] : []),
              ...group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  disabled={busy || Boolean(mutations.states[task.id]?.pending || mutations.states[task.id]?.refreshRequired || mutations.states[task.id]?.editing || mutations.states[task.id]?.statusDialog)}
                  mutation={mutations.states[task.id]}
                  retryDisabled={busy}
                  onRetryRefresh={() => void mutations.retryRefresh(task.id)}
                  onSubtaskStatusChange={(subtask, change) => mutations.changeSubtaskStatus(task.id, subtask, change)}
                  onEditSubtask={(id, change) => mutations.editSubtask(task.id, id, change)}
                  onDeleteSubtask={(id) => mutations.deleteSubtask(task.id, id)}
                  onCreateSubtask={(input) => mutations.createSubtask(task.id, input)}
                  onBeginEdit={() => mutations.beginTaskEdit(task.id)}
                  onEndEdit={() => mutations.endTaskEdit(task.id)}
                  onEdit={(input) => mutations.editTask(task.id, input)}
                  onBeginStatusDialog={() => mutations.beginTaskStatusDialog(task.id)}
                  onEndStatusDialog={() => mutations.endTaskStatusDialog(task.id)}
                  onStatusChange={(change) => mutations.changeTaskStatus(task, change)}
                  expanded={expandedTaskIds.has(task.id)}
                  onToggleSubtasks={() => setExpandedTaskIds((previous) => {
                    const next = new Set(previous);
                    if (next.has(task.id)) next.delete(task.id);
                    else next.add(task.id);
                    return next;
                  })}
                  onToggle={() => void mutations.toggleTask(task)}
                  onDelete={() => void mutations.deleteTask(task.id)}
                  onArchive={() => {
                    setNotice("");
                    void mutations.changeArchived(task).then((changed) => {
                      if (changed) setNotice(task.archivedAt ? "Задачу повернуто з архіву." : "Задачу архівовано.");
                    });
                  }}
                />
              )),
            ])}
          </ul>
        )}
      </section>
    </TasksShell>
  );
}
