"use client";

import uiStyles from "../../../shared/ui/controls.module.css";
import shellStyles from "../../../application/shell/app-shell.module.css";
import taskStyles from "../ui/tasks.module.css";

import { Suspense, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTaskList } from "../hooks/use-task-list";
import { useAreas } from "../../../entities/areas/ui";
import { useOpenDialog } from "../../../shared/hooks/use-open-dialog";
import { useTaskMutations } from "../hooks/use-task-mutations";
import { useTaskFilters } from "../hooks/use-task-filters";
import { taskInSection } from "@/modules/tasks/model/task-context";
import { taskSectionFromPathname } from "../routes";
import { groupTaskList, selectTasks } from "@/modules/tasks/model/task-filters";
import { TaskStatusSummary } from "../ui/task-status-summary";
import { TaskFiltersPanel } from "../ui/task-filters-panel";
import { CreateTaskModal } from "../ui/create-task-modal";
import { TaskCard } from "../ui/task-card";
import { AppShell } from "../../../application/shell/app-shell";
import todayStyles from "../ui/today.module.css";
import { TodayDate } from "../ui/today-date";

export default function Home() {
  return <Suspense fallback={<p role="status" className={uiStyles.loading}>Завантаження задач…</p>}><TasksPage /></Suspense>;
}

function TasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedSection = taskSectionFromPathname(pathname);
  const [section, setSection] = useState(requestedSection);
  const archived = section === "archive";
  const today = section === "today";
  const backlog = section === "backlog";
  const areas = useAreas();
  const { tasks, setTasks, loading, error: loadError, reload, context, scopeKey, inventoryWarning, observeTask } = useTaskList(section, areas.changeRevision);
  const dialogOpen = useOpenDialog();
  // Keep disclosure state separate from refreshed DTOs and keyed by task ID.
  const [disclosures, setDisclosures] = useState<Map<string, boolean>>(() => new Map());
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const taskListRef = useRef<HTMLElement>(null);
  const createScope = useRef(scopeKey);
  const busy = loading || pending !== null;
  const mutations = useTaskMutations(setTasks, busy, (id) => {
    setDisclosures((previous) => previous.has(id) ? previous : new Map(previous).set(id, true));
  }, { context, scopeKey, section, reload, observeTask });
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
  // Record defaults once per Task in the persistent lists workspace.
  if (tasks.some(task => !disclosures.has(task.id))) {
    const next = new Map(disclosures);
    for (const task of tasks) if (!next.has(task.id)) next.set(task.id, today && task.status !== "DONE");
    setDisclosures(next);
  }


  // History can change behind a modal. Preserve its draft and parent locks
  // until the form closes and pending mutations finish.
  const navigationDeferred = requestedSection !== section;
  if (navigationDeferred && !creating && !dialogOpen && pending === null && !mutations.hasLockedTasks) {
    setSection(requestedSection);
    setNotice("");
  }

  return (
    <AppShell contentClassName={today ? todayStyles.main : ""} activeItem={section} query={searchParams.toString()} areasDisabled={busy || creating || dialogOpen || mutations.hasLockedTasks} onNavigate={(href, destination, accepted) => {
      if (creating || dialogOpen || document.querySelector("dialog[open]")) return;
      // Task section changes keep their existing deferred application in this screen.
      if ((destination === "settings" || destination === "routines") && (busy || mutations.hasLockedTasks)) return;
      accepted();
      router.push(href, { scroll: false });
    }} onManageAreas={(open) => {
      if (!busy && !creating && !mutations.hasLockedTasks && !document.querySelector("dialog[open]")) open();
    }}>
      <div className={`${shellStyles.tasksToolbar} ${today ? todayStyles.toolbar : ""}`}>
        <header className={`${shellStyles.header} ${today ? todayStyles.header : ""}`}>
          <div>
            <h1 id="tasks-heading" className={shellStyles.title}>{archived ? "Архів" : today ? "Сьогодні" : backlog ? "Беклог" : "Поточні задачі"}</h1>
            {today && <TodayDate timeZone={context.timezone} />}
            {backlog && <p className={shellStyles.counter}>Задачі, які потребують нового плану: без актуального планування чи майбутнього дедлайну</p>}
          </div>
          <div className={`${shellStyles.taskHeaderActions} ${today ? todayStyles.actions : ""}`}>
            <button type="button" className={uiStyles.secondaryButton} disabled={busy || filtersBlocked} onClick={reload}>
              {today && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5M20 7l-2-2" /></svg>}
              Оновити список
            </button>
            {!archived && <button ref={createButtonRef} className={uiStyles.primaryButton} type="button" disabled={busy} onClick={() => setCreating(true)}>+ Нова задача</button>}
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
            if (currentContext && createScope.current === scopeKey) observeTask(created);
            if (currentContext && createScope.current === scopeKey && belongs) setTasks((previous) => [created, ...previous.filter((task) => task.id !== created.id)]);
            if (!currentContext || createScope.current !== scopeKey) reload();
            setNotice((today || backlog) && (!currentContext || !belongs) ? "Задачу створено. Вона доступна в “Поточних задачах”" : selectTasks([created], view.filters).length ? "Задачу створено." : "Задачу створено. Поточні фільтри приховують її у списку.");
            setCreating(false);
          }}
        />}

        <div className={shellStyles.feedback}>
          <p role="status" className={uiStyles.notice}>{notice}</p>
          {inventoryWarning && <p role="status" className={uiStyles.notice}>{inventoryWarning}</p>}
          {retained.length > 0 && <p role="status" className={uiStyles.notice}>Дані відкритої форми збережено. Її попередня картка тимчасово залишається до закриття форми або завершення оновлення; вона не є результатом актуального запиту.</p>}
          {(navigationDeferred || view.deferred) && <p role="status" className={uiStyles.notice}>Перехід та зміну умов списку буде застосовано після закриття форми та завершення поточних змін.</p>}
        </div>

        <TaskStatusSummary layout={today ? "today" : undefined} tasks={tasks} loading={loading} error={Boolean(loadError)} />

        <TaskFiltersPanel layout={today ? "today" : undefined} filters={view.filters} onChange={view.change} onReset={view.reset} disabled={filtersBlocked}
          total={tasks.length} found={selectedTasks.length} loading={loading} error={Boolean(loadError)} />
      </div>

      <section ref={taskListRef} className={shellStyles.taskScroll} aria-labelledby="tasks-heading" aria-busy={loading} tabIndex={0}>
        {loadError && (
          <div role="alert" className={uiStyles.error}>
            <p>{loadError}</p>
            <button type="button" className={uiStyles.secondaryButton} disabled={busy || filtersBlocked} onClick={reload}>Повторити завантаження</button>
          </div>
        )}
        {loading && <p role="status" className={uiStyles.loading}>Завантаження задач…</p>}
        {!loading && !loadError && tasks.length === 0 && retained.length === 0 && (
          <div className={uiStyles.empty}>
            <span className={uiStyles.emptyIcon} aria-hidden="true">✓</span>
            <h3>{archived ? "Архів порожній" : today ? "На сьогодні задач немає" : backlog ? "Беклог порожній" : "Тут починається ваш план"}</h3>
            {!today && !backlog && <p>{archived ? "Архівовані задачі з’являться тут. Їх можна повернути до поточних задач." : "Натисніть «+ Нова задача», щоб додати першу справу."}</p>}
          </div>
        )}
        {!loading && !loadError && tasks.length > 0 && selectedTasks.length === 0 && retained.length === 0 && <div className={uiStyles.empty}>
          <h3>За цими умовами задач не знайдено</h3>
          <p>Змініть умови або скиньте пошук, фільтри й сортування.</p>
          <button type="button" className={uiStyles.secondaryButton} disabled={filtersBlocked} onClick={view.reset}>Скинути</button>
        </div>}
        {shownTasks.length > 0 && (
          <ul className={`${taskStyles.taskList} ${today ? todayStyles.list : ""}`}>
            {/* Keep every keyed card under the same parent across group moves. */}
            {groupTaskList(shownTasks, section).flatMap((group) => [
              ...(group.title ? [<li key={`group-${group.id}`} className={`${taskStyles.taskGroupHeading} ${today ? todayStyles.group : ""}`} role="presentation">
                <h2>{group.title} <span>({group.tasks.length})</span></h2>
              </li>] : []),
              ...group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  layout={today ? "today" : undefined}
                  task={task}
                  disabled={busy || Boolean(mutations.states[task.id]?.pending || mutations.states[task.id]?.refreshRequired || mutations.states[task.id]?.editing || mutations.states[task.id]?.statusDialog || mutations.states[task.id]?.deleting)}
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
                  expanded={disclosures.get(task.id) ?? (today && task.status !== "DONE")}
                  onToggleSubtasks={() => setDisclosures((previous) => new Map(previous).set(task.id, !(previous.get(task.id) ?? (today && task.status !== "DONE"))))}
                  onToggle={() => void mutations.toggleTask(task)}
                  listFocusRef={taskListRef}
                  onBeginDelete={() => mutations.beginTaskDelete(task.id)}
                  onEndDelete={() => mutations.endTaskDelete(task.id)}
                  onDelete={async () => {
                    const outcome = await mutations.deleteTask(task.id);
                    if (outcome?.status === "deleted") setNotice("Задачу видалено.");
                    else if (outcome?.status === "missing") setNotice("Задача вже недоступна. Список оновлено.");
                    return outcome;
                  }}
                  onCheckDeletion={async () => {
                    const outcome = await mutations.checkTaskRemoval(task.id);
                    if (outcome?.status === "missing") setNotice("Задача вже недоступна. Список оновлено.");
                    return outcome;
                  }}
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
    </AppShell>
  );
}
