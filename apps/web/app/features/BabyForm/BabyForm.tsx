import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { FormError } from "~/components/ui/typography";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { getBrowserTz } from "~/lib/time/browserTz";
import { listFormulas } from "~/lib/api/formulas";
import type { Baby } from "@leon/schemas/baby";
import type { Formula } from "@leon/schemas/formula";
import {
  babyFormSchema,
  toBabyApiBody,
  type BabyFormOut,
  type BabyFormPayload,
  type BabyFormValues,
} from "~/lib/forms/babyForm";

type Props = {
  onSubmit: (data: BabyFormPayload) => void;
  isPending?: boolean;
  submitError?: string | null;
  tz: string;
  /** Existing baby — edit mode. */
  baby?: Baby;
};

const DEFAULT_FORMULA_NAME = "Nan Optipro 1";

function pickDefaultFormulaId(formulas: Formula[]): string | null {
  if (formulas.length === 0) return null;
  const named = formulas.find((f) => f.name === DEFAULT_FORMULA_NAME);
  if (named) return named._id;
  const system = formulas.find((f) => f.isSystem);
  return (system ?? formulas[0])._id;
}

export function BabyForm({
  onSubmit,
  isPending,
  submitError,
  tz,
  baby,
}: Props) {
  const effectiveTz = getBrowserTz(tz);
  const isEdit = baby != null;

  const form = useForm<BabyFormValues, unknown, BabyFormOut>({
    resolver: zodResolver(babyFormSchema),
    defaultValues: {
      name: baby?.name ?? "",
      birthDate: "",
      birthWeightGrams: baby?.birthWeightGrams ?? 3400,
      sex: baby?.sex ?? "male",
      currentFormulaId: baby?.currentFormulaId ?? null,
    },
  });

  // UI state — not form fields.
  const [formulaTouched, setFormulaTouched] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingBody, setPendingBody] = useState<BabyFormPayload | null>(null);

  const formulasQuery = useQuery({
    queryKey: ["formulas"],
    queryFn: listFormulas,
  });
  const formulas = formulasQuery.data ?? [];

  const formulaFieldValue = useWatch({
    control: form.control,
    name: "currentFormulaId",
  });
  // Effective formula for display: explicit user choice, or the default from
  // the list.
  const effectiveFormulaId =
    formulaTouched || formulaFieldValue != null
      ? formulaFieldValue
      : pickDefaultFormulaId(formulas);

  function onValid(v: BabyFormOut) {
    const resolvedFormulaId =
      v.currentFormulaId ?? pickDefaultFormulaId(formulas);
    const formulaChanged =
      isEdit && resolvedFormulaId !== (baby?.currentFormulaId ?? null);
    const body = toBabyApiBody(v, { effectiveTz, resolvedFormulaId });
    if (formulaChanged) {
      setPendingBody(body);
      setWarningOpen(true);
      return;
    }
    onSubmit(body);
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onValid)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя</FormLabel>
              <FormControl>
                <Input type="text" maxLength={50} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дата рождения</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="birthWeightGrams"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Вес при рождении, г</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={100}
                  max={10000}
                  inputMode="numeric"
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sex"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пол</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  className="w-full"
                  value={field.value}
                  onValueChange={(v) => {
                    if (v === "male" || v === "female") field.onChange(v);
                  }}
                >
                  <ToggleGroupItem value="male" className="flex-1">
                    Мальчик
                  </ToggleGroupItem>
                  <ToggleGroupItem value="female" className="flex-1">
                    Девочка
                  </ToggleGroupItem>
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="currentFormulaId"
          render={({ field }) => {
            const selected = formulas.find((f) => f._id === effectiveFormulaId);
            const selectedLabel = selected
              ? selected.brand
                ? `${selected.brand} — ${selected.name}`
                : selected.name
              : "Выберите смесь";
            return (
              <FormItem>
                <FormLabel htmlFor="baby-formula">Смесь</FormLabel>
                <FormControl>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        id="baby-formula"
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal"
                        disabled={
                          formulasQuery.isLoading || formulas.length === 0
                        }
                      >
                        {selectedLabel}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                      {formulas.map((f) => (
                        <DropdownMenuItem
                          key={f._id}
                          onSelect={() => {
                            setFormulaTouched(true);
                            field.onChange(f._id);
                          }}
                        >
                          {f.brand ? `${f.brand} — ${f.name}` : f.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        {submitError && <FormError>{submitError}</FormError>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isEdit ? "Сохранить" : "Создать"}
        </Button>
      </form>

      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сменить смесь?</AlertDialogTitle>
            <AlertDialogDescription>
              Смена смеси пересчитает целевые объёмы и недостачу за все прошлые
              дни в истории и аналитике. Фактически записанные кормления не
              изменятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setWarningOpen(false);
                if (pendingBody) onSubmit(pendingBody);
              }}
            >
              Сменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
