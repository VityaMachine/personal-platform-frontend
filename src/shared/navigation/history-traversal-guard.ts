const STATE_KEY = "personalPlatformHistory";
type Position = { session: string; index: number };
export type TraversalAttempt = { stay: () => void; leave: () => void; returnFocus: HTMLElement | null };
type Blocker = { shouldBlock: () => boolean; confirm: (attempt: TraversalAttempt) => boolean };
type Pending = {
  origin: number; destination: number; prompted: boolean; decision?: "stay" | "leave";
  returnFocus: HTMLElement | null; activeFocus: HTMLElement | null;
};
// Only public Navigation API members. Exact keys avoid relative traversal races
// where supported; History API indices provide the fallback.
type Navigation = {
  currentEntry: { key: string } | null;
  traverseTo: (key: string) => { committed: Promise<unknown>; finished: Promise<unknown> };
};

function position(state: unknown, session: string): number | undefined {
  if (!state || typeof state !== "object" || !(STATE_KEY in state)) return;
  const value = state[STATE_KEY] as Partial<Position> | null;
  if (value?.session === session && Number.isSafeInteger(value.index)) return value.index;
}

/** Tracks this document's entries without adding entries or inspecting router state.
 * Install once above routes, so entries preceding /settings are also tracked.
 * Full-document exits use beforeunload. Untracked positions are never guessed.
 */
export function createHistoryTraversalGuard() {
  let blocker: Blocker | null = null;
  let attach: ((blocker: Blocker | null) => void) | undefined;
  return {
    requestLeave(action: () => void, returnFocus: HTMLElement | null) {
      if (!blocker?.shouldBlock()) { action(); return; }
      let decided = false;
      blocker.confirm({ returnFocus, stay: () => { decided = true; }, leave: () => {
        if (decided) return;
        decided = true; action();
      } });
    },
    register(next: Blocker) {
      blocker = next;
      attach?.(next);
      return () => { if (blocker === next) { blocker = null; attach?.(null); } };
    },
    start(win: Window) {
      const history = win.history;
      const session = win.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const navigation = (win as Window & { navigation?: Navigation }).navigation;
      const keys = new Map<number, string>();
      const push = history.pushState;
      const replace = history.replaceState;
      let current = 0;
      let observed = 0;
      let pending: Pending | null = null;
      let activeBlocker = blocker;
      attach = (value) => { activeBlocker = value; };
      const tagged = (state: unknown, index: number) => ({ ...state as object, [STATE_KEY]: { session, index } });
      const remember = (index: number) => {
        if (navigation?.currentEntry) keys.set(index, navigation.currentEntry.key);
      };
      replace.call(history, tagged(history.state, current), "", win.location.href);
      remember(current);

      function move(index: number) {
        const key = keys.get(index);
        if (navigation && key) {
          const result = navigation.traverseTo(key);
          void result.committed.catch(() => {});
          void result.finished.catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "InvalidStateError" && pending && observed !== index) history.go(index - observed);
          });
        } else history.go(index - observed);
      }

      function settle() {
        const attempt = pending;
        if (!attempt) return;
        if (attempt.decision === "leave") {
          if (observed !== attempt.destination) move(attempt.destination);
          return;
        }
        if (observed !== attempt.origin) { move(attempt.origin); return; }
        attempt.activeFocus?.focus({ preventScroll: true });
        if (attempt.decision === "stay") { pending = null; return; }
        if (attempt.prompted) return;
        attempt.prompted = true;
        const choose = (decision: "stay" | "leave") => {
          if (pending !== attempt || attempt.decision) return;
          attempt.decision = decision;
          settle();
        };
        if (!activeBlocker?.confirm({ returnFocus: attempt.returnFocus, stay: () => choose("stay"), leave: () => choose("leave") })) {
          pending = null;
        }
      }

      function pop(event: PopStateEvent) {
        const index = position(event.state, session);
        if (index === undefined) return;
        observed = index;
        remember(index);
        if (pending?.decision === "leave" && index === pending.destination) {
          current = index; pending = null; return; // Replay exactly once through the router.
        }
        if (!pending && !activeBlocker?.shouldBlock()) { current = index; return; }
        if (!pending && index === current) return;
        // Capture phase runs before the router's ordinary popstate listener.
        // It must not see the temporary destination and unmount the draft.
        event.stopImmediatePropagation();
        const focus = win.document.activeElement instanceof HTMLElement ? win.document.activeElement : null;
        if (!pending) pending = { origin: current, destination: index, prompted: false, returnFocus: focus, activeFocus: focus };
        else if (focus) pending.activeFocus = focus;
        settle();
      }

      const guardedPush: History["pushState"] = function (state, unused, url) {
        const next = current + 1;
        push.call(history, tagged(state, next), unused, url);
        current = observed = next;
        pending = null;
        for (const index of keys.keys()) if (index >= next) keys.delete(index);
        remember(next);
      };
      const guardedReplace: History["replaceState"] = function (state, unused, url) {
        replace.call(history, tagged(state, observed), unused, url);
        remember(observed);
      };
      history.pushState = guardedPush;
      history.replaceState = guardedReplace;
      win.addEventListener("popstate", pop, true);
      return () => {
        win.removeEventListener("popstate", pop, true);
        if (history.pushState === guardedPush) history.pushState = push;
        if (history.replaceState === guardedReplace) history.replaceState = replace;
        attach = undefined;
      };
    },
  };
}
