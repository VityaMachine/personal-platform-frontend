export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} хв`;
  return remainder === 0 ? `${hours} год` : `${hours} год ${remainder} хв`;
}
