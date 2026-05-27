import { z } from "zod";
import { MAX_WEIGHT_GRAMS } from "@leon/schemas/constants";
import { dateISOField, type WeightInput } from "@leon/schemas/weight";

export const weightFormSchema = z.object({
  // REUSE the API schema's dateISO validator (regex + calendar-validity refine) —
  // the form must not be a weaker validator than the API for the same field.
  dateISO: dateISOField,
  grams: z
    .union([z.literal(""), z.number()])
    .refine((v) => v !== "", { message: "Введите вес" })
    .pipe(z.number().int().positive().max(MAX_WEIGHT_GRAMS)),
});

export type WeightFormValues = z.input<typeof weightFormSchema>;
//   => { dateISO: string; grams: number | "" }
export type WeightFormOut = z.output<typeof weightFormSchema>;
//   => { dateISO: string; grams: number }

// Form payload -> API body. Pure. The only delta is the grams -> weightGrams rename.
export function toWeightApiBody(
  v: WeightFormOut,
): Pick<WeightInput, "dateISO" | "weightGrams"> {
  return { dateISO: v.dateISO, weightGrams: v.grams };
}
