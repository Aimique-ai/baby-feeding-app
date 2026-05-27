export const DEFAULT_DURATION_CHIPS = [10, 12, 15, 20] as const;

const MIN_SAMPLE = 5;
const MIN_CHIP = 1;
const MAX_CHIP = 180;

/**
 * Build a 4-chip set around the median feeding duration.
 *  - Always returns exactly 4 numbers, sorted ascending, distinct integers, in [MIN_CHIP..MAX_CHIP].
 *  - On insufficient data (< MIN_SAMPLE) returns DEFAULT_DURATION_CHIPS.
 */
export function computeDurationChips(durations: number[]): number[] {
  if (durations.length < MIN_SAMPLE) return [...DEFAULT_DURATION_CHIPS];

  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const chips = [median - 3, median - 1, median + 2, median + 5]
    .map((v) => Math.round(v))
    .map((v) => Math.min(MAX_CHIP, Math.max(MIN_CHIP, v)));

  chips.sort((a, b) => a - b);

  for (let i = 1; i < chips.length; i++) {
    if (chips[i] <= chips[i - 1]) chips[i] = chips[i - 1] + 1;
  }
  for (let i = chips.length - 1; i > 0; i--) {
    if (chips[i] > MAX_CHIP) chips[i] = MAX_CHIP;
    if (chips[i] <= chips[i - 1]) chips[i - 1] = chips[i] - 1;
  }
  if (chips[0] < MIN_CHIP) {
    chips[0] = MIN_CHIP;
    for (let i = 1; i < chips.length; i++) {
      if (chips[i] <= chips[i - 1]) chips[i] = chips[i - 1] + 1;
    }
  }
  return chips;
}
