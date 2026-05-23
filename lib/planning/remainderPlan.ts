/**
 * Ритм-ориентированная раскладка остатка дня (feeding-rhythm концепция §5–§9).
 *
 * Чистые детерминированные функции: tz приходит явным параметром, никакого
 * process timezone, никаких side-effects. Время — абсолютные UTC-инстанты;
 * сдвиги через addMilliseconds, не через local-wall-clock календарный сдвиг
 * (DST-безопасность, §3.8).
 */

import { addMilliseconds } from "date-fns";
import { localDateISO } from "./dayBoundary";
import type { RemainderPlan, Slot, SlotCountSolution } from "./types";

const MS_PER_HOUR = 3600000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Возрастные коридоры из feedCountRange (концепция §3) с РАСШИРЕНИЕМ границ
 * интервала.
 *
 * range = [minC, maxC].
 *
 * РАСШИРЕНИЕ коридора интервала — из [minC − 0.5, maxC + 0.5]:
 *   intervalMin    = 24 / (maxC + 0.5)
 *   intervalMax    = 24 / (minC − 0.5)
 *   intervalTarget = 24 / round((minC + maxC) / 2)
 *
 * Коридор ПОРЦИИ — от НЕрасширенного range:
 *   portionMin = target / maxC
 *   portionMax = target / minC
 *
 * minC − 0.5 >= 1 всегда (минимальный minC в feedCount.ts = 5) — деления на
 * ноль/отрицательное нет. Чистая, без tz/дат.
 */
export function ageCorridors(args: {
  range: [number, number];
  target: number;
}): {
  intervalMin: number;
  intervalMax: number;
  intervalTarget: number;
  portionMin: number;
  portionMax: number;
} {
  const { range, target } = args;
  const [minC, maxC] = range;

  const intervalMin = 24 / (maxC + 0.5);
  const intervalMax = 24 / (minC - 0.5);
  const intervalTarget = 24 / Math.round((minC + maxC) / 2);

  const portionMin = target / maxC;
  const portionMax = target / minC;

  return { intervalMin, intervalMax, intervalTarget, portionMin, portionMax };
}

/**
 * Сдвиг (часы), на который перекус отодвигает СТАРТ раскладки (концепция §6).
 *
 *   ratio      = clamp(volumeMl / portionMin, 0, 1)
 *   maxStretch = max(0, intervalMax − intervalTarget)
 *   stretch    = ratio · maxStretch
 *
 * stretch ∈ [0, intervalMax − intervalTarget] на один перекус. Чистая.
 */
export function snackStretch(args: {
  volumeMl: number;
  portionMin: number;
  intervalMax: number;
  intervalTarget: number;
}): number {
  const { volumeMl, portionMin, intervalMax, intervalTarget } = args;
  const ratio = clamp(volumeMl / portionMin, 0, 1);
  const maxStretch = Math.max(0, intervalMax - intervalTarget);
  return ratio * maxStretch;
}

/**
 * Выбор N по интервалу (концепция §5.2, исправл. §3.0). РИТМ РЕШАЕТ N —
 * порция в выбор НЕ входит (Principle #1).
 *
 * step(N) = horizonHours / (N + 1), строго убывает по N.
 *
 * GUARD: horizonHours <= 0 → { n: 0, stepHours: 0, reason: "empty" }.
 *
 * Робастный перебор + явный fallback:
 *   nCap       = max(1, ceil(horizonHours / intervalMin))
 *   inCorridor = [ N in 1..nCap+1 :
 *                  intervalMin <= horizonHours/(N+1) <= intervalMax ]
 *   if inCorridor непуст → N со step(N) ближе к intervalTarget,
 *                          тай-брейк МЕНЬШЕЕ N, reason="in-corridor".
 *   else                 → n = max(1, ceil(horizonHours/intervalMax − 1)),
 *                          reason="squeezed" (densest N со step ≤ intervalMax).
 *
 * stepHours = horizonHours / (n + 1).
 */
export function solveSlotCount(args: {
  horizonHours: number;
  intervalMin: number;
  intervalMax: number;
  intervalTarget: number;
}): SlotCountSolution {
  const { horizonHours, intervalMin, intervalMax, intervalTarget } = args;

  // GUARD — вырожденный горизонт (CRIT-A).
  if (horizonHours <= 0) {
    return { n: 0, stepHours: 0, reason: "empty" };
  }

  const nCap = Math.max(1, Math.ceil(horizonHours / intervalMin));

  let bestN = -1;
  let bestDist = Infinity;
  for (let N = 1; N <= nCap + 1; N++) {
    const step = horizonHours / (N + 1);
    if (step < intervalMin - 1e-9 || step > intervalMax + 1e-9) continue;
    const dist = Math.abs(step - intervalTarget);
    // Тай-брейк — МЕНЬШЕЕ N: перебор по возрастанию N, строгое <.
    if (dist < bestDist - 1e-9) {
      bestN = N;
      bestDist = dist;
    }
  }

  if (bestN > 0) {
    return {
      n: bestN,
      stepHours: horizonHours / (bestN + 1),
      reason: "in-corridor",
    };
  }

  // Коридорного N нет. Densest N со step ≤ intervalMax:
  //   N = ceil(horizonHours / intervalMax − 1)
  // Если candidateN < 1 — горизонт настолько мал, что даже один слот лёг бы
  // НИЖЕ intervalMin (step = H/2 < intervalMin). Это «слот вне ритма» —
  // нарушает Principle #1 (РИТМ жёсткий). Вместо впихивания слота в дыру
  // отдаём пустой план: сегодняшний ритм исчерпан, ждём следующего факта /
  // следующего тика ритма уже от нового якоря.
  //
  // Расхождение с feeding-rhythm.md §3.2 (план разрешал step < intervalMin
  // как «один близкий слот корректнее пустоты»): на практике это даёт слот
  // через ~1.5ч после полного кормления при закрытой суточной цели —
  // содержательно вне ритма. Принцип «ритм жёсткий» приоритетнее, чем
  // «не оставлять дыру».
  const candidateN = Math.ceil(horizonHours / intervalMax - 1);
  if (candidateN < 1) {
    return { n: 0, stepHours: 0, reason: "empty" };
  }
  return {
    n: candidateN,
    stepHours: horizonHours / (candidateN + 1),
    reason: "squeezed",
  };
}

/**
 * Размещает n сегодняшних плановых слотов + завтрашний узел от старта
 * раскладки.
 *
 *   плановый слот i = startOfLayout + stepHours·i,  i = 1 .. n
 *   (n+1)-й узел    = startOfLayout + stepHours·(n+1) = горизонт_конец
 *
 * Сдвиг через addMilliseconds (абсолютные UTC-инстанты, §3.8). Полночь
 * today-слоты НЕ фильтрует.
 *
 *   portion = clamp(remainingMl / n, portionMin, portionMax)
 *   ВСЕ n today-слотов И завтрашний узел несут ОДНУ И ТУ ЖЕ порцию.
 *
 * n <= 0 → { today: [], horizonNode: null }.
 */
export function placeSlots(args: {
  startOfLayout: Date;
  n: number;
  stepHours: number;
  remainingMl: number;
  portionMin: number;
  portionMax: number;
}): { today: Slot[]; horizonNode: Slot | null } {
  const { startOfLayout, n, stepHours, remainingMl, portionMin, portionMax } =
    args;

  if (n <= 0) return { today: [], horizonNode: null };

  const portion = clamp(remainingMl / n, portionMin, portionMax);

  const slotAt = (i: number): Slot => ({
    time: addMilliseconds(startOfLayout, i * stepHours * MS_PER_HOUR),
    volumeMl: portion,
  });

  const today: Slot[] = [];
  for (let i = 1; i <= n; i++) {
    today.push(slotAt(i));
  }
  const horizonNode = slotAt(n + 1);

  return { today, horizonNode };
}

/**
 * Оркестрация плана остатка (концепция §5, §9). Чистая, детерминированная.
 *
 * Якоря приходят УЖЕ вычисленными из pipeline (§3.5).
 *
 *   remainingMl   = max(0, target − consumed)
 *   horizonEnd    = addMilliseconds(dayAnchor, 24·3600000)
 *   stretchedTail = addMilliseconds(tailAnchor, snackStretchHours·3600000)
 *   startOfLayout = LATEST из (stretchedTail, lastFactAt ?? stretchedTail,
 *                              dayAnchor)   — сравнение по getTime()
 *   horizonHours  = max(0, (horizonEnd − startOfLayout) / 3600000)
 *
 * GUARD horizonHours <= 0 → план пуст (reason="empty").
 *
 * tomorrowSlot = horizonNode, только если он календарно завтра
 *   (localDateISO(horizonNode.time, tz) !== dateISO); иначе null.
 */
export function planRemainder(args: {
  target: number;
  consumed: number;
  dayAnchor: Date;
  tailAnchor: Date;
  snackStretchHours: number;
  lastFactAt: Date | null;
  range: [number, number];
  dateISO: string;
  tz: string;
}): RemainderPlan {
  const {
    target,
    consumed,
    dayAnchor,
    tailAnchor,
    snackStretchHours,
    lastFactAt,
    range,
    dateISO,
    tz,
  } = args;

  const remainingMl = Math.max(0, target - consumed);
  const horizonEnd = addMilliseconds(dayAnchor, 24 * MS_PER_HOUR);
  const stretchedTail = addMilliseconds(
    tailAnchor,
    snackStretchHours * MS_PER_HOUR,
  );

  // startOfLayout — самый поздний из трёх ограничений (§3.4).
  const lowerByFact = lastFactAt ?? stretchedTail;
  const startMs = Math.max(
    stretchedTail.getTime(),
    lowerByFact.getTime(),
    dayAnchor.getTime(),
  );
  const startOfLayout = new Date(startMs);

  const horizonHours = Math.max(
    0,
    (horizonEnd.getTime() - startOfLayout.getTime()) / MS_PER_HOUR,
  );

  const corridors = ageCorridors({ range, target });

  // Завтрашний узел — НЕ через horizonNode/horizonEnd, а от tailAnchor +
  // intervalTarget. Семантика: «следующее ожидаемое по ритму, оно уже
  // завтра», считается от последнего ПОЛНОЦЕННОГО кормления (tailAnchor —
  // main-like). Это убирает проекцию утреннего якоря на завтра: если день
  // провис и последнее полноценное было в 22:30 — узел сдвигается на
  // 22:30 + intervalTarget, а не остаётся прибитым к firstMainToday+24ч.
  // Порция — portionMin (нижняя граница типичного объёма).
  const projectedTomorrow = addMilliseconds(
    tailAnchor,
    corridors.intervalTarget * MS_PER_HOUR,
  );
  const tomorrowSlot: Slot | null =
    localDateISO(projectedTomorrow, tz) !== dateISO
      ? { time: projectedTomorrow, volumeMl: corridors.portionMin }
      : null;

  // GUARD — поздний старт впритык к горизонту / перекусы съели остаток.
  // Сегодняшних слотов нет, но tomorrowSlot (если он календарно завтра)
  // сохраняется — он от tailAnchor, не от horizonEnd.
  if (horizonHours <= 0) {
    return {
      n: 0,
      reason: "empty",
      stepHours: 0,
      horizonHours,
      slotVolumeMl: 0,
      slots: [],
      tomorrowSlot,
    };
  }

  const { n, stepHours, reason } = solveSlotCount({
    horizonHours,
    intervalMin: corridors.intervalMin,
    intervalMax: corridors.intervalMax,
    intervalTarget: corridors.intervalTarget,
  });

  const { today } = placeSlots({
    startOfLayout,
    n,
    stepHours,
    remainingMl,
    portionMin: corridors.portionMin,
    portionMax: corridors.portionMax,
  });

  return {
    n,
    reason,
    stepHours,
    horizonHours,
    slotVolumeMl: today.length > 0 ? today[0].volumeMl : 0,
    slots: today,
    tomorrowSlot,
  };
}
