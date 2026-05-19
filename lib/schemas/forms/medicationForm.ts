import { z } from "zod";
import {
  MED_DOSE_MAX,
  MED_DOSE_MIN,
  MED_NAME_MAX,
} from "@/lib/schemas/constants";
import type { MedicationInput } from "@/lib/schemas/medication";

export const medicationFormSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(MED_NAME_MAX),
  dose: z
    .union([z.literal(""), z.number()])
    .refine((v) => v !== "", { message: "Введите дозу" })
    .pipe(z.number().int().min(MED_DOSE_MIN).max(MED_DOSE_MAX)),
});

export type MedicationFormValues = z.input<typeof medicationFormSchema>;
//   => { name: string; dose: number | "" }
export type MedicationFormOut = z.output<typeof medicationFormSchema>;
//   => { name: string; dose: number }

// Form -> API. Delta: dose -> defaultDoseDrops rename; name already trimmed by schema.
export function toMedicationApiBody(
  v: MedicationFormOut,
): Pick<MedicationInput, "name" | "defaultDoseDrops"> {
  return { name: v.name, defaultDoseDrops: v.dose };
}
