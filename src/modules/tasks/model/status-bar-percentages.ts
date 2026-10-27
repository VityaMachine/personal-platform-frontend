/** Whole-percent labels only. Segment widths must keep their original ratios. */
export function statusBarPercentages(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return counts.map(() => 0);
  const labels = counts.map((count) => Math.floor(count * 100 / total));
  const ranked = counts.map((count, index) => ({ index, remainder: count * 100 % total }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  const remaining = 100 - labels.reduce((sum, label) => sum + label, 0);
  for (let index = 0; index < remaining; index++) labels[ranked[index].index]++;
  return labels;
}
