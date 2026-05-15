import "server-only";
import wfaData from "./data/wfa.json";
import velocityMonthly from "./data/velocity-monthly.json";
import velocityEarly from "./data/velocity-early.json";
import type { LMS } from "./zscore";

type Sex = "male" | "female";
type WfaRow = { day: number; L: number; M: number; S: number };
type VelocityIntervalRow = {
  intervalKey: string;
  startDays: number;
  endDays: number;
  L: number;
  M: number;
  S: number;
};
type EarlyRow = {
  startDays: number;
  endDays: number;
  byBirthWeight: Record<
    string,
    { p50: number; p25: number; p10: number; p5: number }
  >;
};

const wfa = wfaData as { boys: WfaRow[]; girls: WfaRow[] };
const wv = velocityMonthly as Record<
  string,
  { boys: VelocityIntervalRow[]; girls: VelocityIntervalRow[] }
>;
const wvEarly = velocityEarly as { boys: EarlyRow[]; girls: EarlyRow[] };

function bySex<T>(table: { boys: T; girls: T }, sex: Sex): T {
  return sex === "male" ? table.boys : table.girls;
}

/** Weight-for-age LMS на день жизни. Кламп на границах диапазона 0..1856. */
export function lookupWfaLMS(sex: Sex, ageDays: number): LMS {
  const rows = bySex(wfa, sex);
  const clamped = Math.max(0, Math.min(rows.length - 1, Math.round(ageDays)));
  const r = rows[clamped];
  return { L: r.L, M: r.M, S: r.S };
}

/**
 * Подобрать ВОЗ-таблицу инкремента, ближайшую по длительности к фактическому
 * интервалу. Окна стандарта: 1, 2, 3, 4, 6 месяцев. Возвращает null, если
 * слишком короткий интервал (<14 дней) или вне диапазона возраста таблиц.
 */
export type VelocityHit = {
  windowKey: "1mo" | "2mo" | "3mo" | "4mo" | "6mo";
  intervalLabel: string;
  startDays: number;
  endDays: number;
  intervalDays: number; // длина окна в днях
  lms: LMS;
};

const WINDOW_KEYS = ["1mo", "2mo", "3mo", "4mo", "6mo"] as const;
const WINDOW_DAYS: Record<(typeof WINDOW_KEYS)[number], number> = {
  "1mo": 30,
  "2mo": 60,
  "3mo": 91,
  "4mo": 122,
  "6mo": 183,
};

/**
 * Выбираем окно ближайшее по длительности, потом ищем строку, чей age-диапазон
 * содержит ageDaysAtEnd (возраст ребёнка на момент конца интервала).
 */
export function lookupVelocityLMS(
  sex: Sex,
  intervalDays: number,
  ageDaysAtEnd: number,
): VelocityHit | null {
  if (intervalDays < 14) return null;

  // Ближайшее окно по длительности.
  let bestWin: (typeof WINDOW_KEYS)[number] = "1mo";
  let bestDelta = Infinity;
  for (const k of WINDOW_KEYS) {
    const d = Math.abs(WINDOW_DAYS[k] - intervalDays);
    if (d < bestDelta) {
      bestDelta = d;
      bestWin = k;
    }
  }

  const rows = bySex(wv[bestWin], sex);
  // Ищем строку, чей диапазон возраста содержит ageDaysAtEnd.
  const hit = rows.find(
    (r) => ageDaysAtEnd >= r.startDays && ageDaysAtEnd <= r.endDays,
  );
  if (!hit) return null;

  return {
    windowKey: bestWin,
    intervalLabel: hit.intervalKey.split(":")[1] ?? hit.intervalKey,
    startDays: hit.startDays,
    endDays: hit.endDays,
    intervalDays: hit.endDays - hit.startDays,
    lms: { L: hit.L, M: hit.M, S: hit.S },
  };
}

export function lookupCompletedMonthlyVelocityLMS(
  sex: Sex,
  ageDaysAtEnd: number,
): VelocityHit | null {
  const rows = bySex(wv["1mo"], sex);
  const hit = rows
    .filter((r) => ageDaysAtEnd >= r.endDays)
    .sort((a, b) => b.endDays - a.endDays)[0];
  if (!hit) return null;
  return {
    windowKey: "1mo",
    intervalLabel: hit.intervalKey.split(":")[1] ?? hit.intervalKey,
    startDays: hit.startDays,
    endDays: hit.endDays,
    intervalDays: hit.endDays - hit.startDays,
    lms: { L: hit.L, M: hit.M, S: hit.S },
  };
}

/**
 * Группа веса при рождении для PDF-таблиц 0–60 дней.
 */
export function birthWeightGroup(birthWeightGrams: number): string {
  if (birthWeightGrams < 2500) return "2000-2500";
  if (birthWeightGrams < 3000) return "2500-3000";
  if (birthWeightGrams < 3500) return "3000-3500";
  if (birthWeightGrams < 4000) return "3500-4000";
  return "4000+";
}

/**
 * Эмпирическая velocity-норма для первых 60 дней по группе веса при рождении.
 * Возвращает грубо классифицирующий статус по перцентилю фактической прибавки.
 */
export type EarlyVelocityHit = {
  intervalLabel: string;
  startDays: number;
  endDays: number;
  birthWeightGroup: string;
  p50: number;
  p25: number;
  p10: number;
  p5: number;
};

export function lookupEarlyVelocity(
  sex: Sex,
  birthWeightGrams: number,
  ageDaysAtEnd: number,
): EarlyVelocityHit | null {
  const rows = bySex(wvEarly, sex);
  const hit = rows.find(
    (r) => ageDaysAtEnd > r.startDays && ageDaysAtEnd <= r.endDays,
  );
  if (!hit) return null;
  const group = birthWeightGroup(birthWeightGrams);
  const v = hit.byBirthWeight[group];
  if (!v) return null;
  return {
    intervalLabel: `${hit.startDays}–${hit.endDays} дн`,
    startDays: hit.startDays,
    endDays: hit.endDays,
    birthWeightGroup: group,
    p50: v.p50,
    p25: v.p25,
    p10: v.p10,
    p5: v.p5,
  };
}

export function lookupCompletedEarlyVelocity(
  sex: Sex,
  birthWeightGrams: number,
  ageDaysAtEnd: number,
): EarlyVelocityHit | null {
  const rows = bySex(wvEarly, sex);
  const hit = rows
    .filter((r) => ageDaysAtEnd >= r.endDays)
    .sort((a, b) => b.endDays - a.endDays)[0];
  if (!hit) return null;
  const group = birthWeightGroup(birthWeightGrams);
  const v = hit.byBirthWeight[group];
  if (!v) return null;
  return {
    intervalLabel: `${hit.startDays}–${hit.endDays} дн`,
    startDays: hit.startDays,
    endDays: hit.endDays,
    birthWeightGroup: group,
    p50: v.p50,
    p25: v.p25,
    p10: v.p10,
    p5: v.p5,
  };
}
