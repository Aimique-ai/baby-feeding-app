import { startOfLocalDay, isBirthday } from "./dayBoundary";
import { ageCorridors, planRemainder, snackStretch } from "./remainderPlan";
import type { Feeding, RemainderPlan } from "./types";

const MS_PER_HOUR = 3600000;

export type PipelineResult = {
  consumed: number;
  mainsToday: number;
  dayAnchor: Date;
  tailAnchor: Date;
  snackStretchHours: number;
  lastFactAt: Date | null;
  plan: RemainderPlan;
};

/**
 * feeding-rhythm §3.5 — единый проход по фактам + расчёт двух якорей +
 * один вызов planRemainder.
 *
 * Якорь суток (dayAnchor) — стабильный, фиксирует конец горизонта.
 * Якорь хвоста (tailAnchor) — подвижный, фиксирует старт раскладки.
 *
 * `prevMainCandidates` — последние ~5 записей ЛЮБОГО типа до начала дня
 * (Q-D2 вариант 3). runPipeline сам выбирает последний main-like — он
 * знает portionMin.
 *
 * isMainLike(f) = !isTopUp ИЛИ volumeMl >= portionMin.
 */
export function runPipeline(args: {
  facts: Feeding[];
  target: number;
  dateISO: string;
  tz: string;
  range: [number, number];
  birthDate: Date;
  prevMainCandidates: Feeding[];
}): PipelineResult {
  const { facts, target, dateISO, tz, range, birthDate, prevMainCandidates } =
    args;

  const dayStart = startOfLocalDay(dateISO, tz);
  const { portionMin, intervalMax, intervalTarget } = ageCorridors({
    range,
    target,
  });

  const isMainLike = (f: Feeding): boolean =>
    !f.isTopUp || (f.volumeMl ?? 0) >= portionMin;

  // Q-D2 — последнее main-like кормление среди кандидатов прошлого дня.
  const prevSorted = [...prevMainCandidates].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );
  let prevMainRaw: Feeding | null = null;
  for (const f of prevSorted) {
    if (isMainLike(f)) prevMainRaw = f;
  }

  // Stale-check — применяется к ОБОИМ якорям (O1).
  const prevMainAnchorFresh =
    prevMainRaw &&
    dayStart.getTime() - prevMainRaw.startAt.getTime() <=
      intervalMax * MS_PER_HOUR
      ? prevMainRaw.startAt
      : null;

  const sorted = [...facts].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  let consumed = 0;
  let mainsToday = 0;
  let firstMainToday: Date | null = null;
  let lastTailMove: Date | null = null;
  let snackStretchHours = 0;
  let lastFactAt: Date | null = null;

  for (const f of sorted) {
    consumed += f.volumeMl ?? 0;
    lastFactAt = f.startAt;

    if (isMainLike(f)) {
      lastTailMove = f.startAt;
      snackStretchHours = 0; // СБРОС: покормили полноценно.
      if (f.startAt.getTime() >= dayStart.getTime()) {
        mainsToday += 1;
        if (firstMainToday === null) firstMainToday = f.startAt;
      }
    } else {
      // Перекус — копит сдвиг ПОСЛЕ актуального якоря (§3.6).
      snackStretchHours += snackStretch({
        volumeMl: f.volumeMl ?? 0,
        portionMin,
        intervalMax,
        intervalTarget,
      });
    }
  }

  const dayAnchor = isBirthday(birthDate, dateISO, tz)
    ? birthDate
    : (firstMainToday ?? prevMainAnchorFresh ?? dayStart);

  const tailAnchor = lastTailMove ?? prevMainAnchorFresh ?? dayAnchor;

  const plan = planRemainder({
    target,
    consumed,
    dayAnchor,
    tailAnchor,
    snackStretchHours,
    lastFactAt,
    range,
    dateISO,
    tz,
  });

  return {
    consumed,
    mainsToday,
    dayAnchor,
    tailAnchor,
    snackStretchHours,
    lastFactAt,
    plan,
  };
}
