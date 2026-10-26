"use client";
import { useEffect, useRef, useState } from "react";
import type { Routine, RoutinePreviewRange, RoutineGenerationPreview, RoutineGenerationResult, GenerateRoutineInput } from "@/lib/routine-types";
import { getRoutineGenerationPreview, generateRoutine } from "@/lib/routines";
import { defaultRoutinePreviewRange, routinePreviewRangeError } from "@/lib/routine-format";
import { routineGenerationFailure } from "@/lib/routine-generation-error";
import { buildGenerationPayload, reconcileGenerationPlanning, type GenerationPlanningDrafts } from "@/lib/routine-generation-planning";
import { invalidateTaskList } from "@/lib/task-list-invalidation";
import { SCHEDULE_CHANGED_EVENT } from "@/lib/routine-schedule-versions";

type PreviewState = { data: RoutineGenerationPreview | null; ready: boolean; loading: boolean; error: string | null };
type Attempt = { body: string; drafts: GenerationPlanningDrafts };
type PostError = { message: string; uncertain: boolean; payload: GenerateRoutineInput };
const sameRange = (a: RoutinePreviewRange, b: RoutinePreviewRange) => a.from === b.from && a.to === b.to;
const copyDrafts = (drafts: GenerationPlanningDrafts): GenerationPlanningDrafts => Object.fromEntries(Object.entries(drafts).map(([key, value]) => [key, { ...value }]));

export function useRoutineGeneration(routine: Routine, onSubmittingChange: (pending: boolean) => void) {
  const [baseline, setBaseline] = useState<RoutinePreviewRange>(() => defaultRoutinePreviewRange(routine.timezone));
  const [range, setRange] = useState<RoutinePreviewRange>(baseline);
  const rangeRef = useRef(range);
  const [drafts, setDrafts] = useState<GenerationPlanningDrafts>({});
  const draftsRef = useRef(drafts);
  const [preview, setPreview] = useState<PreviewState>({ data: null, ready: false, loading: false, error: null });
  const previewRequest = useRef<AbortController | null>(null);
  const readyPreview = useRef<RoutineGenerationPreview | null>(null);
  const postRequest = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [planningErrors, setPlanningErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<RoutineGenerationResult | null>(null);
  const [error, setError] = useState<PostError | null>(null);
  const [uncertainAttempt, setUncertainAttempt] = useState<Attempt | null>(null);
  useEffect(() => () => { previewRequest.current?.abort(); postRequest.current?.abort(); }, []);
  useEffect(() => {
    const invalidate = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== routine.id) return;
      previewRequest.current?.abort(); readyPreview.current = null;
      setPreview((previous) => ({ ...previous, ready: false, loading: false }));
      setNotice("Розклад змінився. Оновіть generation-preview: планування збережено за ключами виконань; зниклі ключі буде вилучено після GET.");
    };
    window.addEventListener(SCHEDULE_CHANGED_EVENT, invalidate);
    return () => window.removeEventListener(SCHEDULE_CHANGED_EVENT, invalidate);
  }, [routine.id]);

  function storeDrafts(next: GenerationPlanningDrafts) { draftsRef.current = next; setDrafts(next); }
  function changeRange(key: keyof RoutinePreviewRange, value: string) {
    if (inFlight.current) return;
    previewRequest.current?.abort();
    readyPreview.current = null;
    const next = { ...rangeRef.current, [key]: value }; rangeRef.current = next; setRange(next);
    setPreview((previous) => ({ ...previous, ready: false, loading: false, error: null }));
    setRangeError(null); setResult(null); setError((previous) => previous?.uncertain ? previous : null);
  }
  function changePlanning(key: string, value: string, choice?: string, date?: string) {
    const snapshot = readyPreview.current;
    if (inFlight.current || !snapshot || !sameRange(snapshot, rangeRef.current)
      || !snapshot.occurrences.some((entry) => entry.occurrenceKey === key && !entry.existing)) return;
    storeDrafts({ ...draftsRef.current, [key]: { value, ...(choice ? { choice } : {}), ...(date !== undefined ? { date } : {}) } });
    setPlanningErrors((previous) => { const next = { ...previous }; delete next[key]; return next; });
  }
  async function loadPreview() {
    if (inFlight.current || routine.pausedAt !== null) return;
    const requested = { ...rangeRef.current };
    const invalid = routinePreviewRangeError(requested); setRangeError(invalid);
    if (invalid) return;
    previewRequest.current?.abort();
    readyPreview.current = null;
    const controller = new AbortController(); previewRequest.current = controller;
    setPreview((previous) => ({ ...previous, loading: true, ready: false, error: null }));
    try {
      const data = await getRoutineGenerationPreview(routine.id, requested, controller.signal);
      if (controller.signal.aborted || previewRequest.current !== controller || !sameRange(requested, rangeRef.current)) return;
      const reconciled = reconcileGenerationPlanning(draftsRef.current, data.occurrences);
      let message = reconciled.removed.length ? `Планування для ${reconciled.removed.length} виконань вилучено: вони зникли з діапазону або вже існують. Перевірте перелік перед явним створенням задач.` : null;
      const changedZones = data.occurrences.filter((entry) => {
        const previous = preview.data?.occurrences.find((old) => old.occurrenceKey === entry.occurrenceKey);
        return previous && previous.timezone !== entry.timezone && reconciled.drafts[entry.occurrenceKey]?.value;
      });
      if (changedZones.length) {
        for (const entry of changedZones) delete reconciled.drafts[entry.occurrenceKey].choice;
        message = `${message ? `${message} ` : ""}Часовий пояс виконання змінився. Перевірте локальний час планування та повторно виберіть UTC-зсув, якщо потрібно.`;
      }
      storeDrafts(reconciled.drafts); setPlanningErrors({}); setNotice(message);
      readyPreview.current = data; setPreview({ data, loading: false, ready: true, error: null });
      setError((previous) => previous?.uncertain ? previous : null);
    } catch (failure) {
      if (!controller.signal.aborted && previewRequest.current === controller && sameRange(requested, rangeRef.current)) {
        setPreview((previous) => ({ ...previous, loading: false, ready: false, error: routineGenerationFailure(failure).uncertain
          ? "Не вдалося завантажити виконання. Введене планування збережено. Повторіть лише завантаження." : routineGenerationFailure(failure).message }));
      }
    }
  }
  function cancelPreview() {
    previewRequest.current?.abort();
    readyPreview.current = null;
    setPreview((previous) => ({ ...previous, loading: false, ready: false, error: "Завантаження скасовано. Діапазон і введене планування збережено." }));
  }
  async function send(attempt: Attempt, exactRetry: boolean): Promise<"success" | "error" | null> {
    if (inFlight.current || routine.pausedAt !== null) return null;
    const payload = JSON.parse(attempt.body) as GenerateRoutineInput;
    previewRequest.current?.abort();
    readyPreview.current = null;
    setPreview((previous) => ({ ...previous, ready: false, loading: false }));
    const controller = new AbortController(); postRequest.current = controller;
    inFlight.current = true; setPending(true); onSubmittingChange(true); setResult(null); setError(null);
    try {
      const data = await generateRoutine(routine.id, payload, controller.signal);
      if (controller.signal.aborted) return null;
      setResult(data); setBaseline({ from: payload.from, to: payload.to }); setUncertainAttempt(null);
      // Keep any newer, unsent draft that preceded an exact retry. Consumed values
      // are cleared; the candidate snapshot remains read-only until another GET.
      storeDrafts(Object.fromEntries(Object.entries(draftsRef.current).filter(([key, draft]) => {
        const sent = attempt.drafts[key]; return !sent || sent.value !== draft.value || sent.choice !== draft.choice || sent.date !== draft.date;
      })));
      setPlanningErrors({}); invalidateTaskList(); return "success";
    } catch (failure) {
      if (controller.signal.aborted) return null;
      const outcome = routineGenerationFailure(failure);
      if (outcome.uncertain) { setUncertainAttempt(attempt); invalidateTaskList(); }
      else if (exactRetry) setUncertainAttempt(null);
      setError({ ...outcome, payload, message: exactRetry && !outcome.uncertain
        ? `Повторний запит відхилено. Початковий запит міг виконатися. ${outcome.message}` : outcome.message });
      return "error";
    } finally {
      if (!controller.signal.aborted) { inFlight.current = false; setPending(false); onSubmittingChange(false); }
    }
  }
  const current = preview.ready && !preview.loading && preview.data !== null && sameRange(preview.data, range);
  async function generate(): Promise<"success" | "error" | "validation" | null> {
    const snapshot = readyPreview.current;
    if (inFlight.current || uncertainAttempt || !snapshot || !sameRange(snapshot, rangeRef.current) || routine.pausedAt !== null) return null;
    const invalid = routinePreviewRangeError(rangeRef.current); setRangeError(invalid);
    if (invalid) return "validation";
    const parsed = buildGenerationPayload(rangeRef.current, snapshot, draftsRef.current, routine.schedule.recurrence.type === "AFTER_COMPLETION");
    setPlanningErrors(parsed.errors); setRangeError(parsed.error);
    if (parsed.error || Object.keys(parsed.errors).length) return "validation";
    return send({ body: JSON.stringify(parsed.payload), drafts: copyDrafts(draftsRef.current) }, false);
  }
  return { range, changeRange, drafts, changePlanning, preview, current, loadPreview, cancelPreview,
    rangeError, planningErrors, notice, pending, result, error, generate,
    uncertainPayload: uncertainAttempt ? JSON.parse(uncertainAttempt.body) as GenerateRoutineInput : null,
    retryExact: () => uncertainAttempt ? send(uncertainAttempt, true) : Promise.resolve(null),
    canGenerate: current && !pending && !uncertainAttempt && routine.pausedAt === null,
    isPosting: () => inFlight.current,
    dirty: !sameRange(range, baseline) || Object.values(drafts).some((draft) => Boolean(draft.value) || draft.date !== undefined),
  };
}
