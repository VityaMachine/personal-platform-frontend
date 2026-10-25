"use client";
import type { Routine } from "@/lib/routine-types";
import { RoutineFormModal } from "./routine-form-modal";

export function CreateRoutineModal({ onCreated, ...props }: {
  opener: HTMLButtonElement; timezone: string; onClose: () => void;
  onCreated: (routine: Routine) => void; onSubmittingChange: (pending: boolean) => void;
}) {
  return <RoutineFormModal {...props} onSaved={onCreated} />;
}
