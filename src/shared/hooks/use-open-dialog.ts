"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
  return () => observer.disconnect();
}

// Native dialogs already own draft/discard confirmation. Keep their owner mounted
// when browser history changes the requested section, until every dialog closes.
export function useOpenDialog() {
  return useSyncExternalStore(subscribe, () => Boolean(document.querySelector("dialog[open]")), () => false);
}
