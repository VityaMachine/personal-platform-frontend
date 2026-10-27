// Run with: node --test tests/routine-schedule-versions.test.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { routine, routineId, configuration, versions, version, range, occurrence, generationPreview, generationResult, conflict, futureTask } from "./routine-fixtures.mjs";

// Compile the actual application modules using its installed TypeScript. No test dependencies.
const load = createRequire(import.meta.url), ts = load("typescript"), Module = load("node:module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request, ...args);
};
load.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const api = load("../src/lib/routines.ts"), validation = load("../src/lib/routine-validation.ts");
const helpers = load("../src/lib/routine-schedule-versions.ts");
const { Temporal } = load("@js-temporal/polyfill");
const { routineToFields, parseUpdateRoutineFields } = load("../src/lib/edit-routine-input.ts");
const { parseCreateRoutineFields, initialRoutineFields, routineApiFieldErrors } = load("../src/lib/create-routine-input.ts");
const { reconcileGenerationPlanning, buildGenerationPayload } = load("../src/lib/routine-generation-planning.ts");
const now = Temporal.Instant.from("2026-10-26T12:00:00Z");

test("automation defaults, strict DTO, horizon bounds and minimal non-calendar PATCH", () => {
  const defaults = initialRoutineFields("Europe/Kyiv");
  assert.equal(defaults.autoGenerate, false); assert.equal(defaults.generationHorizonDays, "7");
  const fields = routineToFields(routine);
  for (const horizon of [1, 30]) {
    assert(validation.isRoutine({ ...routine, generationHorizonDays: horizon }));
    assert.equal(parseCreateRoutineFields({ ...fields, generationHorizonDays: String(horizon) }, []).input.generationHorizonDays, horizon);
  }
  for (const horizon of [0, 31, 1.5, "7", undefined]) assert(!validation.isRoutine({ ...routine, generationHorizonDays: horizon }));
  for (const raw of ["0", "31", "1.5", "", "NaN"]) assert(parseCreateRoutineFields({ ...fields, generationHorizonDays: raw }, []).errors.generationHorizonDays);
  assert(!validation.isRoutine({ ...routine, autoGenerate: "true" }));
  assert.deepEqual(parseUpdateRoutineFields(routine, { ...fields, autoGenerate: true }, []).input, { autoGenerate: true });
  assert.deepEqual(parseUpdateRoutineFields(routine, { ...fields, generationHorizonDays: "30" }, []).input, { generationHorizonDays: 30 });
  const enabled = { ...routine, autoGenerate: true, generationHorizonDays: 30 };
  assert.deepEqual(parseUpdateRoutineFields(enabled, { ...routineToFields(enabled), autoGenerate: false }, []).input, { autoGenerate: false });
  const completion = { ...enabled, schedule: { version: 1, localTime: null, recurrence: { type: "AFTER_COMPLETION", intervalDays: 3 } }, pausedAt: "2026-10-27T10:00:00Z" };
  assert(validation.isRoutine(completion));
  assert.equal(parseCreateRoutineFields(routineToFields(completion), []).input.generationHorizonDays, 30);
  assert.equal(parseUpdateRoutineFields(completion, routineToFields(completion), []).input, null);
  assert.deepEqual(Object.keys(routineApiFieldErrors([{ path: ["autoGenerate"] }, { path: ["generationHorizonDays"] }], fields, []).errors), ["autoGenerate", "generationHorizonDays"]);
});

test("automation POST/PATCH validate responses without generating or creating schedule versions", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://mock.invalid/api";
  const requests = []; let response = { ...routine, autoGenerate: true, generationHorizonDays: 30 }, status = 200;
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return new Response(JSON.stringify(response), { status }); };
  const input = parseCreateRoutineFields({ ...routineToFields(routine), autoGenerate: true, generationHorizonDays: "30" }, []).input;
  assert.deepEqual(await api.createRoutine(input), response);
  assert.deepEqual(await api.updateRoutine(routineId, { autoGenerate: true }), response);
  assert.deepEqual(JSON.parse(requests.at(-1).body), { autoGenerate: true });
  for (const code of [400, 409, 500]) { status = code; await assert.rejects(api.updateRoutine(routineId, { autoGenerate: false })); }
  status = 200; response = { ...routine, generationHorizonDays: 31 };
  await assert.rejects(api.updateRoutine(routineId, { autoGenerate: true }));
  assert(requests.every(({ url }) => /\/routines(?:\/[\w-]+)?$/.test(url)));
});

test("initial/current/future are determined by effectiveAt, not insertion order", () => {
  assert(validation.isRoutine(routine)); assert(validation.isRoutineScheduleVersionList(versions));
  assert.deepEqual(versions.map((v) => helpers.scheduleVersionStatus(v, versions, now)), ["Попередній", "Чинний", "Майбутній"]);
  assert.equal(helpers.scheduleVersionStatus(versions[0], [versions[0]], now), "Чинний");
  assert(!validation.isRoutineScheduleVersionList([versions[1], versions[0]]));
  assert(!validation.isRoutineScheduleVersion({ ...versions[0], effectiveAt: "2026-01-01T00:00:00Z" }));
});
test("minimum date, strict version order, midnight, DST and immutable effectiveTimezone", () => {
  assert.equal(helpers.minimumEffectiveDate(versions.slice(0, 2), now), "2026-10-27");
  assert.equal(helpers.minimumEffectiveDate(versions, now), "2090-11-02");
  const fields = routineToFields(routine);
  assert(helpers.parseScheduleVersionFields(fields, "2026-10-26", versions.slice(0, 2), now).effectiveError);
  assert(helpers.parseScheduleVersionFields(fields, "2090-11-01", versions, now).effectiveError);
  const parsed = helpers.parseScheduleVersionFields({ ...fields, timezone: "America/Los_Angeles" }, "2090-11-02", versions, now);
  assert(parsed.input); assert.equal(parsed.input.timezone, "America/Los_Angeles");
  assert.equal(Temporal.PlainDate.from(parsed.input.effectiveDate).toZonedDateTime(versions[0].effectiveTimezone).toInstant().toString(), "2090-11-01T22:00:00Z");
  const boundary = Temporal.Instant.from("2026-10-26T22:00:00Z");
  assert.equal(helpers.minimumEffectiveDate(versions.slice(0, 2), boundary), "2026-10-28");
  assert.equal(helpers.minimumEffectiveDate(Array(100).fill(versions[0]), now), null);
});
test("full calendar validation, modes, AFTER_COMPLETION anchor and COUNT", () => {
  const fields = routineToFields(routine);
  assert(helpers.parseScheduleVersionFields({ ...fields, recurrence: "AFTER_COMPLETION" }, "2090-11-02", versions, now).errors.recurrence);
  const completion = version(1, "2026-01-01", "2025-12-31T22:00:00Z", { ...configuration, schedule: { version: 1, localTime: null, recurrence: { type: "AFTER_COMPLETION", intervalDays: 3 } } });
  assert(helpers.parseScheduleVersionFields({ ...routineToFields({ ...routine, ...completion }), startDate: "2026-02-01" }, "2090-11-02", [completion], now).errors.startDate);
  const parsed = helpers.parseScheduleVersionFields({ ...fields, endType: "COUNT", endCount: "10" }, "2090-11-02", versions, now);
  assert.deepEqual(parsed.input.endCondition, { type: "COUNT", count: 10 });
  assert(helpers.parseScheduleVersionFields({ ...fields, endType: "UNTIL_DATE", endDate: "2025-01-01" }, "2090-11-02", versions, now).errors.endDate);
});
test("additive conflicts and SKIPPED basis preserve existing DTO contracts", () => {
  assert(validation.isRoutineGenerationPreview(generationPreview)); assert(validation.isRoutineGenerationResult(generationResult));
  assert(validation.isRoutinePreview({ ...generationPreview, truncated: false, limitations: [] }));
  assert(validation.isRoutineGenerationPreview({ ...generationPreview, conflicts: undefined }));
  assert(!validation.isRoutineGenerationPreview({ ...generationPreview, conflicts: [{ ...conflict, retainedTaskId: null }] }));
  assert(validation.isRoutineGenerationPreview({ ...generationPreview, occurrences: [{ ...occurrence, basisType: "SKIPPED", basisAt: "2026-10-26T00:00:00Z", basisCompletedAt: null }] }));
});
test("full future Task and SKIPPED DTO regression, including basisType/basisAt", () => {
  const { isTask, isSubtask } = load("../src/lib/task-validation.ts");
  assert(isTask(futureTask));
  assert(isTask({ ...futureTask, status: "SKIPPED", skipNote: "Skip", skippedAt: "2026-10-26T12:00:00.000Z",
    routineOccurrence: { ...futureTask.routineOccurrence, basisType: "SKIPPED", basisAt: "2026-10-25T12:00:00.000Z", basisCompletedAt: null } }));
  assert(!isSubtask({ ...futureTask, taskId: futureTask.id, status: "SKIPPED" }));
});
test("stale planning removed, unchanged keys kept, existing excluded, timezone per occurrence", () => {
  const drafts = { [occurrence.occurrenceKey]: { value: "2090-11-01T10:00" }, stale: { value: "2090-11-01T11:00" }, "stored-future": { value: "2090-11-01T12:00" } };
  const reconciled = reconcileGenerationPlanning(drafts, generationPreview.occurrences);
  assert.deepEqual(reconciled.removed, ["stale", "stored-future"]);
  assert.deepEqual(reconciled.drafts[occurrence.occurrenceKey], drafts[occurrence.occurrenceKey]);
  const parsed = buildGenerationPayload(range, { ...generationPreview, timezone: "America/Los_Angeles" }, drafts, false);
  assert.deepEqual(parsed.payload.planning, [{ occurrenceKey: occurrence.occurrenceKey, plannedAt: "2090-11-01T08:00:00.000Z" }]);
});
test("template PATCH excludes every calendar field; creation retains its initial schedule", () => {
  const fields = routineToFields(routine);
  const patch = parseUpdateRoutineFields(routine, { ...fields, title: "Edited", timezone: "UTC", dailyInterval: "7", startDate: "2026-03-01", endType: "COUNT", endCount: "5" }, []).input;
  assert.deepEqual(patch, { title: "Edited" });
  assert.equal(parseUpdateRoutineFields(routine, fields, []).input, null);
  assert.deepEqual(parseCreateRoutineFields(fields, []).input.schedule, configuration.schedule);
});
test("mock HTTP: exact full POST, AbortSignal, 400/409/uncertainty, pause/resume/delete/create/generate", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://mock.invalid/api";
  const requests = [], controller = new AbortController();
  let status = 200, response = versions;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return new Response(status === 204 ? null : JSON.stringify(response), { status, headers: { "Content-Type": "application/json" } });
  };
  assert.deepEqual(await api.getRoutineScheduleVersions(routineId, controller.signal), versions);
  assert.equal(requests.at(-1).signal, controller.signal);
  const input = { effectiveDate: "2090-11-02", ...configuration };
  response = version(4, input.effectiveDate, "2090-11-01T22:00:00Z"); status = 201;
  await api.createRoutineScheduleVersion(routineId, { ...input, title: "must not leak" }, controller.signal);
  assert.deepEqual(JSON.parse(requests.at(-1).body), input); assert.equal(requests.at(-1).signal, controller.signal);
  for (const code of [400, 409, 500]) {
    status = code; response = { error: { message: "mock" } };
    await assert.rejects(api.createRoutineScheduleVersion(routineId, input), (error) => helpers.scheduleVersionFailure(error).uncertain === (code === 500));
  }
  status = 201; response = {}; await assert.rejects(api.createRoutineScheduleVersion(routineId, input), (error) => helpers.scheduleVersionFailure(error).uncertain);
  status = 200; response = routine;
  await api.updateRoutine(routineId, { title: "Edited" }); assert.deepEqual(JSON.parse(requests.at(-1).body), { title: "Edited" });
  await api.setRoutinePaused(routineId, true); assert.deepEqual(JSON.parse(requests.at(-1).body), { paused: true });
  await api.setRoutinePaused(routineId, false); assert.deepEqual(JSON.parse(requests.at(-1).body), { paused: false });
  await api.createRoutine(parseCreateRoutineFields(routineToFields(routine), []).input); assert.equal(requests.at(-1).method, "POST");
  response = generationResult; await api.generateRoutine(routineId, range); assert.deepEqual(JSON.parse(requests.at(-1).body), range);
  status = 204; await api.deleteRoutine(routineId); assert.equal(requests.at(-1).body, undefined);
  assert(requests.every((request) => request.url.startsWith("http://mock.invalid/api/")));
});
