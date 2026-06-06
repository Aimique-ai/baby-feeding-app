export const feedingsKey = (babyId: string, dateISO: string, tz: string) =>
  ["feedings", "v3", babyId, dateISO, tz] as const;

export const babyKey = (babyId: string) => ["baby", babyId] as const;
export const weightsKey = (babyId: string) => ["weights", babyId] as const;
export const weightsAnalyticsKey = (babyId: string, tz: string) =>
  ["weights", "analytics", babyId, tz] as const;
export const feedingsAnalyticsKey = (babyId: string, tz: string) =>
  ["feedings", "analytics", babyId, tz] as const;
export const feedingsPlanKey = (babyId: string, dateISO: string, tz: string) =>
  ["feedings", "plan", babyId, dateISO, tz] as const;
export const medicationsKey = (babyId: string) =>
  ["medications", babyId] as const;
export const feedingsDurationChipsKey = (babyId: string) =>
  ["feedings", "duration-chips", babyId] as const;
export const historyKey = (babyId: string, tz: string) =>
  ["history", babyId, tz] as const;

export const babiesKey = ["babies"] as const;
export const archivedBabiesKey = ["babies", "archived"] as const;
