export const feedingsKey = (babyId: string, dateISO: string) =>
  ["feedings", "v2", babyId, dateISO] as const;

export const babyKey = (babyId: string) => ["baby", babyId] as const;
export const weightsKey = (babyId: string) =>
  ["weights", babyId] as const;
export const weightsAnalyticsKey = (babyId: string) =>
  ["weights", "analytics", babyId] as const;
export const medicationsKey = (babyId: string) =>
  ["medications", babyId] as const;

export const babiesKey = ["babies"] as const;
export const archivedBabiesKey = ["babies", "archived"] as const;
