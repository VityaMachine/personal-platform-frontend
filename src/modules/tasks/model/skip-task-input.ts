export function parseSkipTaskNote(note: string): { input: { status: "SKIPPED"; skipNote: string | null }; error?: never } | { error: string; input?: never } {
  const trimmed = note.trim();
  if (trimmed.length > 2000) return { error: "Причина пропуску має містити не більше 2000 символів." };
  return { input: { status: "SKIPPED", skipNote: trimmed || null } };
}
