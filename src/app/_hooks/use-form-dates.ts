"use client";

import { useState } from "react";
import { useSettings } from "./use-settings";
import type { DateField } from "@/lib/zoned-date";

export function useFormDates() {
  const { settings } = useSettings();
  // A cross-tab preference change must not reinterpret an existing draft.
  const [timeZone] = useState(settings.timeZone);
  const [choices, setChoices] = useState<Partial<Record<DateField, string>>>({});
  return {
    timeZone, choices,
    options: { timeZone, choices },
    hint: `Часовий пояс форми: ${timeZone}.${timeZone !== settings.timeZone ? " Налаштування змінилися; ця відкрита форма зберігає попередній пояс до закриття." : ""}`,
    choose: (field: DateField, iso: string) => setChoices((previous) => ({ ...previous, [field]: iso })),
    clear: (field: DateField) => setChoices((previous) => ({ ...previous, [field]: undefined })),
  };
}
