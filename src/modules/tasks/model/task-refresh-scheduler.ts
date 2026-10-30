import { MAX_REFRESH_DELAY } from "./task-refresh";

type Events = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type Clock = Events & { setTimeout: (callback: () => void, delay: number) => number; clearTimeout: (id: number | undefined) => void };

/** One observed boundary, one timer, one refresh even if wake-up events coincide. */
export function watchTaskRefresh(boundary: number, refresh: () => void, clock: Clock, visibility: Events & { readonly visibilityState: string }, now = Date.now) {
  let timer: number | undefined;
  let requested = false;
  let stopped = false;
  function check() {
    clock.clearTimeout(timer);
    timer = undefined;
    if (stopped || requested || visibility.visibilityState === "hidden") return;
    const remaining = boundary - now();
    if (remaining <= 0) { requested = true; refresh(); }
    else if (Number.isFinite(remaining)) timer = clock.setTimeout(check, Math.min(remaining, MAX_REFRESH_DELAY));
  }
  clock.addEventListener("focus", check);
  visibility.addEventListener("visibilitychange", check);
  check();
  return () => {
    stopped = true; clock.clearTimeout(timer);
    clock.removeEventListener("focus", check);
    visibility.removeEventListener("visibilitychange", check);
  };
}
