import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { BIRTH_WEIGHT_MAX, BIRTH_WEIGHT_MIN } from "@/lib/schemas/constants";

// LEON-RHF-3 (user decision): BabyFormPayload is DEFINED here, in the schema layer —
// NOT imported from the component. BabyForm.tsx and BabyList.tsx import it from this
// file. This keeps lib/ self-contained (no lib/ -> components/ dependency).
export type BabyFormPayload = {
  name: string;
  birthDate: Date;
  birthWeightGrams: number;
  sex: "male" | "female";
  currentFormulaId: string | null;
};

export const babyFormSchema = z.object({
  name: z.string().trim().min(1, "Введите имя"),
  // <input type="datetime-local"> emits "" until filled; "" must fail validation.
  // birthDate's type is plain `string` on BOTH z.input and z.output — `z.literal("")`
  // is a SUBTYPE of `string`, so a `string | ""` union collapses to `string`. The
  // `.refine()` carries the empty-check at RUNTIME; the static type stays `string`.
  birthDate: z.string().refine((v) => v !== "", {
    message: "Укажите дату рождения",
  }),
  birthWeightGrams: z
    .union([z.literal(""), z.number()])
    .refine((v) => v !== "", { message: "Введите вес" })
    .pipe(z.number().int().min(BIRTH_WEIGHT_MIN).max(BIRTH_WEIGHT_MAX)),
  sex: z.enum(["male", "female"]),
  // null until the user picks (or until the async default is applied lazily at submit).
  currentFormulaId: z.union([z.string(), z.null()]),
});

export type BabyFormValues = z.input<typeof babyFormSchema>;
//   => { name: string; birthDate: string; birthWeightGrams: number | "";
//        sex: "male"|"female"; currentFormulaId: string | null }
export type BabyFormOut = z.output<typeof babyFormSchema>;
//   => { name: string; birthDate: string; birthWeightGrams: number;
//        sex: "male"|"female"; currentFormulaId: string | null }

// Form -> API. Pure. fromZonedTime converts the datetime-local wall-clock string,
// interpreted AS effectiveTz, into a UTC Date. resolvedFormulaId is supplied by the
// caller because the async default is resolved lazily inside onValid (not on the form).
export function toBabyApiBody(
  v: BabyFormOut,
  opts: { effectiveTz: string; resolvedFormulaId: string | null },
): BabyFormPayload {
  return {
    name: v.name,
    birthDate: fromZonedTime(v.birthDate, opts.effectiveTz),
    birthWeightGrams: v.birthWeightGrams,
    sex: v.sex,
    currentFormulaId: opts.resolvedFormulaId,
  };
}
