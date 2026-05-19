// Shared numeric bounds — imported by API schemas (lib/schemas/*.ts)
// AND form schemas (lib/schemas/forms/*.ts) so the two cannot drift.

export const MAX_WEIGHT_GRAMS = 50000; // weight.ts: weightGrams.max
export const MIN_WEIGHT_GRAMS = 1; // weight.ts: weightGrams.positive

export const MED_DOSE_MIN = 1; // medication.ts + feeding.ts
export const MED_DOSE_MAX = 100;
export const MED_NAME_MAX = 50; // medication.ts: name.max

export const FEEDING_VOLUME_MIN = 1; // feeding.ts volumeMl.min — smallest accepted
// volume (server and form both adopt it)
export const FEEDING_VOLUME_MAX = 200; // feeding.ts: volumeMl.max
export const FEEDING_DURATION_MAX_MIN = 180; // feeding.ts: MAX_FEEDING_DURATION_MS is
// FEEDING_DURATION_MAX_MIN * 60 * 1000

export const BIRTH_WEIGHT_MIN = 100; // baby.ts birthWeightGrams.min + BabyForm
export const BIRTH_WEIGHT_MAX = 10000; // baby.ts birthWeightGrams.max + BabyForm
