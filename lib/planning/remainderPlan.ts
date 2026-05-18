/**
 * Свежий пересчёт остатка дня (feed-plan-rewrite §3).
 *
 * Чистые детерминированные функции: tz приходит явным параметром, никакого
 * process timezone, никаких side-effects. Остаток дня `remainingMl`
 * раскладывается на K слотов, где K выводится из возрастного `feedCountRange`.
 */

import { addMilliseconds } from "date-fns";
import { endOfLocalDay } from "./dayBoundary";
import { floor5, round5 } from "@/lib/format/ml";
import type { FeedCountSolution, RemainderPlan, Slot } from "./types";

const MS_PER_HOUR = 3600000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Единственная формула шага (часы) между соседними слотами.
 * K слотов делят промежуток [anchor, endOfLocalDay] на (K+1) интервалов.
 * Общий хелпер: и тай-брейк в solveFeedCount, и размещение в placeSlots
 * зовут ЭТУ функцию — формула не дублируется.
 *   k <= 0 → 0
 */
export function stepHoursFor(k: number, remainingHours: number): number {
  if (k <= 0) return 0;
  return remainingHours / (k + 1);
}

/**
 * Чистый выбор K оставшихся кормлений. Работает только с числами.
 *
 * Ранний guard: remainingMl <= 0 → { k:0, reason:"clamped-low" } ДО алгебры
 * окон — цель достигнута или переедание, плана нет.
 *
 * Окно (a) — норма порции, целые: aLoI = ceil(remainingMl·minC/target),
 *   aHiI = floor(remainingMl·maxC/target).
 * Окно (b) — счёт основных: bLo = minC − mainsToday, bHi = maxC − mainsToday.
 * Валидное множество = целые K в [max(aLoI, bLo, 1), min(aHiI, bHi)].
 *
 * Непустое пересечение → тай-брейк по (c): шаг ближе к центру [24/maxC,
 * 24/minC]; при равенстве — порция remainingMl/K ближе к центру окна (a).
 * reason = "intersect".
 *
 * Пустое пересечение — исчерпывающее ветвление (порядок важен):
 *   if (aHiI < bLo)      → "clamped-low",  K = bLo  — (a) целиком ниже (b),
 *                          переедание: порций нужно меньше, чем счёт (b).
 *   else if (aLoI > bHi) → "clamped-high", K = bHi  — (a) целиком выше (b),
 *                          недобор: порций нужно больше, чем счёт (b).
 *   else                 → "best-effort"            — окно (a) вырождено
 *                          ВНУТРИ (b) (aHiI < aLoI, ни выше ни ниже): идеального
 *                          K в норме порции нет. Перебираем целые K в окне (b)
 *                          [max(bLo,1), bHi] и берём тот, у которого порция
 *                          remainingMl/K минимально далека от коридора
 *                          [target/maxC, target/minC] (расстояние 0 если внутри,
 *                          иначе до ближайшей границы). Тай-брейк — меньшее K.
 *                          Сознательно жертвуем точным попаданием в target ради
 *                          адекватной динамики кормления. Если окно (b) само
 *                          пусто (bHi < max(bLo,1), напр. mainsToday >= maxC) —
 *                          fallback K = bLo (финальный кламп сведёт к 0).
 *
 * Финальный кламп: K = clamp(K, 0, max(0, maxC − mainsToday)).
 */
export function solveFeedCount(args: {
  target: number;
  remainingMl: number;
  remainingHours: number;
  range: [number, number];
  mainsToday: number;
}): FeedCountSolution {
  const { target, remainingMl, remainingHours, range, mainsToday } = args;
  const [minC, maxC] = range;

  // Ранний guard — до любой алгебры окон.
  if (remainingMl <= 0) {
    return { k: 0, reason: "clamped-low" };
  }

  const finalClamp = (k: number): number =>
    clamp(Math.round(k), 0, Math.max(0, maxC - mainsToday));

  // Окно (a) — норма порции, приведённое к целым.
  const aLoI = Math.ceil((remainingMl * minC) / target);
  const aHiI = Math.floor((remainingMl * maxC) / target);
  // Окно (b) — счёт основных.
  const bLo = minC - mainsToday;
  const bHi = maxC - mainsToday;

  const lo = Math.max(aLoI, bLo, 1);
  const hi = Math.min(aHiI, bHi);

  if (lo <= hi) {
    // Непустое пересечение — тай-брейк по (c), затем по (a).
    const stepCenter = (24 / maxC + 24 / minC) / 2;
    const portionCenter = (target / maxC + target / minC) / 2;
    let bestK = lo;
    let bestStepDist = Infinity;
    let bestPortionDist = Infinity;
    for (let k = lo; k <= hi; k++) {
      const stepDist = Math.abs(stepHoursFor(k, remainingHours) - stepCenter);
      const portionDist = Math.abs(remainingMl / k - portionCenter);
      if (
        stepDist < bestStepDist - 1e-9 ||
        (Math.abs(stepDist - bestStepDist) <= 1e-9 &&
          portionDist < bestPortionDist - 1e-9)
      ) {
        bestK = k;
        bestStepDist = stepDist;
        bestPortionDist = portionDist;
      }
    }
    return { k: finalClamp(bestK), reason: "intersect" };
  }

  // Пустое пересечение — исчерпывающее ветвление.
  if (aHiI < bLo) {
    return { k: finalClamp(bLo), reason: "clamped-low" };
  }
  if (aLoI > bHi) {
    return { k: finalClamp(bHi), reason: "clamped-high" };
  }

  // Окно (a) вырождено внутри (b): идеального K нет. Выбираем K из окна (b) с
  // порцией минимально далёкой от коридора нормы [target/maxC, target/minC].
  const portionLo = target / maxC;
  const portionHi = target / minC;
  const portionGap = (k: number): number => {
    const portion = remainingMl / k;
    if (portion < portionLo) return portionLo - portion;
    if (portion > portionHi) return portion - portionHi;
    return 0;
  };

  const searchLo = Math.max(bLo, 1);
  if (searchLo > bHi) {
    // Окно (b) само пусто (напр. mainsToday >= maxC) — нечего перебирать.
    return { k: finalClamp(bLo), reason: "best-effort" };
  }

  let bestK = searchLo;
  let bestGap = Infinity;
  for (let k = searchLo; k <= bHi; k++) {
    const gap = portionGap(k);
    if (gap < bestGap - 1e-9) {
      bestK = k;
      bestGap = gap;
    }
  }
  return { k: finalClamp(bestK), reason: "best-effort" };
}

/**
 * Размещает K слотов в позициях anchor + step·i, i=1..K,
 * где step = stepHoursFor(K, remainingHours).
 *
 * Объёмы — точная сумма с инвариантом неотрицательности (§3.3):
 *   base = floor5(remainingMl / K); rem = remainingMl − base·K;
 *   extras = floor(rem / 5); leftover = rem − extras·5;
 *   слоты[0..extras−1] = base+5; слот[extras] = base+leftover; остальные base.
 * Σ = remainingMl, все слагаемые >= 0.
 *
 * K <= 0 → пустой массив. Слоты дальше endOfLocalDay в массив не попадают,
 * но шаг считается от полного K — раскладка равномерна до полуночи.
 */
export function placeSlots(args: {
  anchor: Date;
  k: number;
  remainingMl: number;
  remainingHours: number;
  dateISO: string;
  tz: string;
}): Slot[] {
  const { anchor, k, remainingMl, remainingHours, dateISO, tz } = args;
  if (k <= 0) return [];

  const step = stepHoursFor(k, remainingHours);
  const dayEnd = endOfLocalDay(dateISO, tz);

  const base = floor5(remainingMl / k);
  const rem = remainingMl - base * k;
  const extras = Math.floor(rem / 5);
  const leftover = rem - extras * 5;

  const volumeAt = (i: number): number => {
    if (i < extras) return base + 5;
    if (i === extras) return base + leftover;
    return base;
  };

  const slots: Slot[] = [];
  for (let i = 1; i <= k; i++) {
    const time = addMilliseconds(anchor, i * step * MS_PER_HOUR);
    if (time.getTime() >= dayEnd.getTime()) continue;
    slots.push({ time, volumeMl: volumeAt(i - 1) });
  }
  return slots;
}

/**
 * Оркестрация: считает remainingMl и remainingHours, зовёт solveFeedCount →
 * placeSlots. Чистая, детерминированная.
 *
 * remainingMl    = max(0, target − consumed)
 * remainingHours = max(0, (endOfLocalDay − anchor) / 3600000)
 *
 * GUARD remainingHours <= 0 → форсировать K=0, план пуст, reason="clamped-low".
 * GUARD remainingMl <= 0 → solveFeedCount сам вернёт K=0 (ранний guard).
 */
export function planRemainder(args: {
  target: number;
  consumed: number;
  mainsToday: number;
  anchor: Date;
  dateISO: string;
  tz: string;
  range: [number, number];
}): RemainderPlan {
  const { target, consumed, mainsToday, anchor, dateISO, tz, range } = args;

  const remainingMl = Math.max(0, target - consumed);
  const dayEnd = endOfLocalDay(dateISO, tz);
  const remainingHours = Math.max(
    0,
    (dayEnd.getTime() - anchor.getTime()) / MS_PER_HOUR,
  );

  // Guard: нулевое время — все слоты отфильтровались бы за границей дня.
  if (remainingHours <= 0) {
    return {
      k: 0,
      reason: "clamped-low",
      slotVolumeMl: 0,
      stepHours: 0,
      slots: [],
    };
  }

  const { k, reason } = solveFeedCount({
    target,
    remainingMl,
    remainingHours,
    range,
    mainsToday,
  });

  const slots = placeSlots({
    anchor,
    k,
    remainingMl,
    remainingHours,
    dateISO,
    tz,
  });

  return {
    k,
    reason,
    slotVolumeMl: k > 0 ? round5(remainingMl / k) : 0,
    stepHours: stepHoursFor(k, remainingHours),
    slots,
  };
}
