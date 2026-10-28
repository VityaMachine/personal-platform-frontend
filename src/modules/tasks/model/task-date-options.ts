export type DateField = "plannedAt" | "dueAt";
export type DateOptions = { timeZone: string; choices?: Partial<Record<DateField, string>> };
