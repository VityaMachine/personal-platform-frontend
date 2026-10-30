"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./task-menu.module.css";

type Item = { id: string; label: string; danger?: boolean; select: (opener: HTMLButtonElement) => void };

// All card menus share one non-modal owner, including menus in nested rows.
const openedEvent = "tasks-menu-opened";
export function TaskMenu({ title, disabled, items }: { title: string; disabled: boolean; items: Item[] }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initialIndex = useRef(0);
  const [open, setOpen] = useState(false);
  const visible = open && !disabled;

  useLayoutEffect(() => {
    if (!visible) return;
    const button = trigger.current!, panel = menu.current!;
    function position() {
      const anchor = button.getBoundingClientRect();
      if (anchor.bottom < 0 || anchor.top > innerHeight) { setOpen(false); return; }
      const height = panel.offsetHeight, width = panel.offsetWidth;
      panel.style.left = `${Math.max(8, Math.min(anchor.right - width, innerWidth - width - 8))}px`;
      panel.style.top = `${Math.max(8, Math.min(anchor.bottom + 4 + height <= innerHeight - 8 ? anchor.bottom + 4 : anchor.top - height - 4, innerHeight - height - 8))}px`;
    }
    function outside(event: PointerEvent) {
      if (!panel.contains(event.target as Node) && !button.contains(event.target as Node)) setOpen(false);
    }
    function other(event: Event) { if ((event as CustomEvent).detail !== id) setOpen(false); }
    function focusOutside(event: FocusEvent) {
      if (!panel.contains(event.target as Node) && event.target !== button) setOpen(false);
    }
    position();
    const resize = new ResizeObserver(position);
    resize.observe(button);
    resize.observe(document.body);
    panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[initialIndex.current]?.focus();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    window.addEventListener(openedEvent, other);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      window.removeEventListener(openedEvent, other);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focusOutside);
    };
  }, [visible, id]);

  function show(last = false) {
    if (disabled || document.querySelector("dialog[open]")) return;
    initialIndex.current = last ? items.length - 1 : 0;
    window.dispatchEvent(new CustomEvent(openedEvent, { detail: id }));
    setOpen(true);
  }
  return <>
    <button ref={trigger} type="button" className={styles.trigger} data-task-menu=""
      aria-label={`Дії задачі: ${title}`} aria-haspopup="menu" aria-expanded={visible} aria-controls={visible ? id : undefined}
      aria-disabled={disabled}
      onClick={() => { if (visible) setOpen(false); else show(); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(event.key === "ArrowUp"); }
      }}>⋯</button>
    {visible && createPortal(<div ref={menu} id={id} role="menu" aria-label={`Дії: ${title}`} className={styles.menu}
      onKeyDown={(event) => {
        const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | undefined;
        if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
        if (event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = buttons.length - 1;
        if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
        // Return to the trigger before native Tab traversal; do not trap focus in the portal.
        if (event.key === "Tab") { setOpen(false); trigger.current?.focus(); }
      }}>
      {items.map(item => <div key={item.id} role="none">
        {item.danger && <div role="separator" className={styles.separator} />}
        <button type="button" role="menuitem" tabIndex={-1} data-task-action={item.id} className={item.danger ? styles.danger : undefined}
          onClick={() => {
            setOpen(false);
            const opener = trigger.current!;
            opener.focus();
            if (!disabled) item.select(opener);
          }}>{item.label}</button>
      </div>)}
    </div>, document.body)}
  </>;
}
