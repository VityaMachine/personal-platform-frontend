"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createArea, updateArea, deleteArea, type Area } from "@/entities/areas/api/areas";
import { areaNameError } from "@/entities/areas/model/area-validation";
import { ApiError } from "@/shared/api/api";
import { useAreas } from "../model/use-areas";
import { DiscardChangesDialog } from "../../../shared/ui/discard-changes-dialog";
import { DeleteAreaDialog } from "./delete-area-dialog";
import styles from "../../../app/page.module.css";
import local from "./areas.module.css";

export function AreasModal({ opener, onClose }: {
  opener: HTMLButtonElement; onClose: () => void;
}) {
  const directory = useAreas();
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const nextAction = useRef<(() => void) | null>(null);
  const [editor, setEditor] = useState({ id: "", name: "", initial: "" });
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [deleting, setDeleting] = useState<Area | null>(null);
  const dirty = editor.name !== editor.initial;
  const locked = pending || directory.loading;

  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    const protectPending = (event: Event) => { if (inFlight.current) event.preventDefault(); };
    dialog?.addEventListener("cancel", protectPending);
    dialog?.showModal(); nameRef.current?.focus(); document.body.style.overflow = "hidden";
    return () => { dialog?.removeEventListener("cancel", protectPending); dialog?.close(); document.body.style.overflow = overflow;
      requestAnimationFrame(() => { if (opener.isConnected) opener.focus(); }); };
  }, [opener]);

  function request(action: () => void) {
    if (inFlight.current || confirmingDiscard || deleting) return;
    if (dirty) { nextAction.current = action; setConfirmingDiscard(true); }
    else action();
  }
  function edit(area?: Area) {
    setEditor({ id: area?.id ?? "", name: area?.name ?? "", initial: area?.name ?? "" });
    setFieldError(undefined); setError(null);
    requestAnimationFrame(() => nameRef.current?.focus());
  }
  async function mutate(action: () => Promise<Area | null>, message: string, changedId?: string) {
    if (inFlight.current || directory.loading) return;
    closeRef.current?.focus();
    inFlight.current = true; setPending(true); setError(null); setNotice("");
    try {
      const area = await action();
      directory.commit(area, changedId);
      setNotice(message);
      setEditor({ id: "", name: "", initial: "" }); setFieldError(undefined); setDeleting(null);
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch (error) {
      setError(error instanceof ApiError && error.status === 404 ? "Сферу вже видалено. Оновіть список сфер."
        : error instanceof Error ? error.message : "Не вдалося зберегти сферу. Спробуйте ще раз.");
    } finally { inFlight.current = false; setPending(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault(); if (inFlight.current || locked) return;
    const error = areaNameError(editor.name); setFieldError(error);
    if (error) { nameRef.current?.focus(); return; }
    if (editor.id && editor.name.trim() === editor.initial) { edit(); return; }
    void mutate(() => editor.id ? updateArea(editor.id, { name: editor.name.trim() }) : createArea({ name: editor.name.trim() }),
      editor.id ? "Сферу перейменовано." : "Сферу створено.", editor.id || undefined);
  }
  return <dialog ref={dialogRef} className={styles.modal} aria-modal="true" aria-labelledby={`${id}-heading`}
    onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); request(onClose); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        if (!confirmingDiscard && !deleting) request(onClose);
        return;
      }
      if (confirmingDiscard || deleting || event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className={styles.modalLayout}>
      <header className={styles.modalHeader}>
        <h2 ref={headingRef} tabIndex={-1} id={`${id}-heading`} className={styles.sectionTitle}>Сфери</h2>
        <button ref={closeRef} type="button" className={styles.closeButton} aria-label="Закрити керування сферами" aria-disabled={pending} onClick={() => request(onClose)}>✕</button>
      </header>
      <div className={styles.modalBody}>
        <form onSubmit={save} className={local.editor} aria-busy={pending} noValidate>
          <label className={styles.field} htmlFor={`${id}-name`}>{editor.id ? "Перейменувати сферу" : "Нова сфера"}
            <input ref={nameRef} id={`${id}-name`} value={editor.name} disabled={pending} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${id}-error` : undefined}
              onChange={(event) => { if (!inFlight.current) { setEditor({ ...editor, name: event.target.value }); setFieldError(undefined); } }} />
            {fieldError && <span id={`${id}-error`} className={styles.fieldError}>{fieldError}</span>}
          </label>
          <div className={local.actions}>
            <button type="submit" className={styles.primaryButton} disabled={locked}>{pending ? "Збереження…" : editor.id ? "Зберегти назву" : "Створити сферу"}</button>
            {editor.id && <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => request(() => edit())}>Скасувати перейменування</button>}
          </div>
        </form>
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        {error && !deleting && <p role="alert" className={styles.error}>{error}</p>}
        {directory.error && <p role="alert" className={styles.error}>{directory.error}</p>}
        <button type="button" className={styles.addSubtaskButton} disabled={locked} onClick={directory.reload}>Оновити список сфер</button>
        {directory.loading && <p role="status">Завантаження сфер…</p>}
        {!directory.loading && !directory.error && directory.areas.length === 0 && <p>Сфер ще немає. Створіть першу сферу.</p>}
        <ul className={local.list}>
          {directory.areas.map((area) => <li key={area.id}>
            <span>{area.name}</span><div className={local.actions}>
              <button type="button" className={styles.secondaryButton} disabled={locked} onClick={() => request(() => edit(area))}>Перейменувати</button>
              <button type="button" className={styles.deleteButton} disabled={locked} onClick={() => request(() => { edit(); setError(null); setDeleting(area); })}>Видалити</button>
            </div>
          </li>)}
        </ul>
      </div>
    </div>
    {confirmingDiscard && <DiscardChangesDialog onContinue={() => { nextAction.current = null; setConfirmingDiscard(false); }} onDiscard={() => { const action = nextAction.current; nextAction.current = null; setConfirmingDiscard(false); action?.(); }} />}
    {deleting && <DeleteAreaDialog name={deleting.name} pending={pending} error={error} onClose={() => { if (!inFlight.current) { setDeleting(null); setError(null); } }}
      onConfirm={() => void mutate(async () => { await deleteArea(deleting.id); return null; }, "Сферу видалено. Пов’язані задачі залишилися без сфери.", deleting.id)} />}
  </dialog>;
}
