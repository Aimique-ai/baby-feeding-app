/**
 * Клиент-совместимые типы для аналитики веса. Не импортируй из этого файла
 * server-only утилиты — только типы.
 */

export type AnalyticsVelocitySource = "who-lms" | "who-early";
export type AnalyticsEarlyClass =
  | "p50+"
  | "p25-50"
  | "p10-25"
  | "p5-10"
  | "below-p5";

export type AnalyticsEarlyRef = {
  intervalLabel: string;
  birthWeightGroup: string;
  p50: number;
  p25: number;
  p10: number;
  p5: number;
};

export type AnalyticsVelocity = {
  source: AnalyticsVelocitySource;
  intervalLabel: string;
  intervalDays: number;
  fromDate: string;
  toDate: string;
  fromWeightGrams: number;
  toWeightGrams: number;
  deltaGrams: number;
  z: number | null;
  percentile: number | null;
  earlyClass?: AnalyticsEarlyClass;
  earlyRef?: AnalyticsEarlyRef;
};

export type AnalyticsPoint = {
  _id: string;
  date: string;
  weightGrams: number;
  ageDays: number;
  zWeightForAge: number;
  percentile: number;
  // Чистые факты между этим и предыдущим замером:
  daysSincePrev: number | null;
  deltaSincePrev: number | null;
  gramsPerDay: number | null;
};

/** Агрегированная WHO-оценка темпа за последний завершённый месячный интервал. */
export type MonthlyVelocity = {
  fromDate: string; // ISO начала завершённого WHO-интервала
  toDate: string; // ISO конца завершённого WHO-интервала
  fromWeightGrams: number; // интерполированный
  toWeightGrams: number;
  deltaGrams: number;
  intervalLabel: string; // напр. "0–4 wks", "4 wks–2 mo"
  intervalDays: number;
  z: number;
  percentile: number;
};

/** Тренд перцентиля за последние ~28 дней. */
export type PercentileTrend = {
  fromPercentile: number;
  toPercentile: number;
  fromDate: string;
  toDate: string;
};

export type WeightsAnalytics = {
  birthDate: string;
  birthWeightGrams: number;
  sex: "male" | "female";
  ageDaysNow: number;
  points: AnalyticsPoint[];
  earlyVelocity: AnalyticsVelocity | null;
  monthlyVelocity: MonthlyVelocity | null;
  percentileTrend: PercentileTrend | null;
};
