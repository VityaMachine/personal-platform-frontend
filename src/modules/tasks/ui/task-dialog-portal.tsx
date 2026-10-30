"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import todayStyles from "./today.module.css";

// Moving a card between groups must not remove an open native dialog from the
// browser's top layer. Keep the React owner, but use a stable DOM parent.
export function TaskDialogPortal({ layout, children }: { layout?: "today"; children: ReactNode }) {
  return createPortal(<div style={{ display: "contents" }} className={layout === "today" ? todayStyles.main : undefined}>{children}</div>, document.body);
}
