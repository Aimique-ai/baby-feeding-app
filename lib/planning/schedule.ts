import { addMilliseconds } from "date-fns";
import { endOfLocalDay } from "./dayBoundary";
import {
  STEP_MIN_HOURS,
  STEP_MAX_HOURS,
  STEP_IDEAL_HOURS,
} from "./constants";

const HOUR_MS = 3600 * 1000;

/**
 * Ось A — расписание (когда кормить), без учёта объёма.
 *
 * Возвращает времена слотов от `lastStart` до конца локального дня. Шаг между
 * соседними слотами лежит в [STEP_MIN_HOURS, STEP_MAX_HOURS] часов; число
 * слотов K выбирается так, чтобы `alreadyToday + K` было ближе всего к
 * `feedingsPerDay`. При равенстве предпочитаем шаг ближе к STEP_IDEAL_HOURS.
 *
 * Fallback:
 *  - если хвост ≤ FALLBACK_MIN_HOURS — слотов нет;
 *  - если ни одно K не даёт шаг в окне — один rhythm-слот в середине окна
 *    (чтобы пользователь не остался без напоминания).
 */
export function buildRhythmSlots(args: {
  lastStart: Date;
  dateISO: string;
  tz: string;
  feedingsPerDay: number;
  alreadyToday: number;
}): Date[] {
  const { lastStart, dateISO, tz, feedingsPerDay, alreadyToday } = args;
  const dayEnd = endOfLocalDay(dateISO, tz);
  const totalHours = (dayEnd.getTime() - lastStart.getTime()) / HOUR_MS;

  // K слотов делят промежуток [lastStart, dayEnd] на (K+1) равных интервалов:
  // step = totalHours / (K+1). Это даёт буфер ≈ step ≥ STEP_MIN до полуночи,
  // т.е. последний слот не «прижимается» к 24:00 (никаких 23:59).
  //
  // Условие на шаг: STEP_MIN ≤ totalHours/(K+1) ≤ STEP_MAX  →
  //   (totalHours/STEP_MAX) − 1 ≤ K ≤ (totalHours/STEP_MIN) − 1.
  const kMin = Math.max(1, Math.ceil(totalHours / STEP_MAX_HOURS - 1));
  const kMax = Math.floor(totalHours / STEP_MIN_HOURS - 1);

  const candidates: number[] = [];
  for (let k = kMin; k <= kMax; k++) candidates.push(k);

  // Окно ни для какого K не укладывается в [STEP_MIN, STEP_MAX] —
  // плановых слотов в этом дне больше нет (последнее кормление слишком близко
  // к полуночи или попало в зазор шире 3.5ч от dayEnd).
  if (candidates.length === 0) return [];

  const chosenK = candidates.reduce((best, k) => {
    const dBest = Math.abs(best + alreadyToday - feedingsPerDay);
    const dK = Math.abs(k + alreadyToday - feedingsPerDay);
    if (dK !== dBest) return dK < dBest ? k : best;
    const stepBest = totalHours / (best + 1);
    const stepK = totalHours / (k + 1);
    const distBest = Math.abs(stepBest - STEP_IDEAL_HOURS);
    const distK = Math.abs(stepK - STEP_IDEAL_HOURS);
    return distK < distBest ? k : best;
  }, candidates[0]);

  // Слоты i=1..K в позиции lastStart + step·i, где step = totalHours/(K+1).
  // Последний слот = lastStart + K·step = lastStart + totalHours·K/(K+1),
  // что строго < dayEnd с запасом ≥ STEP_MIN.
  const stepMs = (totalHours * HOUR_MS) / (chosenK + 1);
  const slots: Date[] = [];
  for (let i = 1; i <= chosenK; i++) {
    slots.push(addMilliseconds(lastStart, stepMs * i));
  }
  return slots;
}
