"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FormError, Muted } from "@/components/ui/typography";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getBrowserTz } from "@/lib/time/browserTz";
import type {
  SerializedBaby,
  SerializedFormula,
} from "@/lib/api/serializedTypes";

export type BabyFormPayload = {
  name: string;
  birthDate: Date;
  birthWeightGrams: number;
  feedingsPerDay: number;
  sex: "male" | "female";
  currentFormulaId: string | null;
};

type Props = {
  onSubmit: (data: BabyFormPayload) => void;
  isPending?: boolean;
  submitError?: string | null;
  tz: string;
  /** Существующий ребёнок — режим редактирования. */
  baby?: SerializedBaby;
};

const DEFAULT_FORMULA_NAME = "Nan Optipro 1";

async function fetchFormulas(): Promise<SerializedFormula[]> {
  const r = await fetch("/api/formulas", { cache: "no-store" });
  if (!r.ok) throw new Error("formulas fetch failed");
  return r.json();
}

function pickDefaultFormulaId(formulas: SerializedFormula[]): string | null {
  if (formulas.length === 0) return null;
  const named = formulas.find((f) => f.name === DEFAULT_FORMULA_NAME);
  if (named) return named._id;
  const system = formulas.find((f) => f.isSystem);
  return (system ?? formulas[0])._id;
}

export function BabyForm({ onSubmit, isPending, submitError, tz, baby }: Props) {
  const effectiveTz = getBrowserTz(tz);
  const isEdit = baby != null;
  const [name, setName] = useState(baby?.name ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [birthWeightGrams, setBirthWeightGrams] = useState<number>(
    baby?.birthWeightGrams ?? 3400,
  );
  const [feedingsPerDay, setFeedingsPerDay] = useState<number>(
    baby?.feedingsPerDay ?? 8,
  );
  const [sex, setSex] = useState<"male" | "female">(baby?.sex ?? "male");
  const [formulaId, setFormulaId] = useState<string | null>(
    baby?.currentFormulaId ?? null,
  );
  const [formulaTouched, setFormulaTouched] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);

  const formulasQuery = useQuery({
    queryKey: ["formulas"],
    queryFn: fetchFormulas,
  });
  const formulas = formulasQuery.data ?? [];

  // Эффективное значение смеси: явный выбор пользователя либо дефолт из списка.
  const effectiveFormulaId =
    formulaTouched || formulaId != null
      ? formulaId
      : pickDefaultFormulaId(formulas);

  const invalid =
    name.trim().length < 1 ||
    !birthDate ||
    birthWeightGrams <= 0 ||
    feedingsPerDay < 1 ||
    feedingsPerDay > 24;

  const formulaChanged =
    isEdit && effectiveFormulaId !== (baby?.currentFormulaId ?? null);

  function emit() {
    onSubmit({
      name: name.trim(),
      birthDate: fromZonedTime(birthDate, effectiveTz),
      birthWeightGrams,
      feedingsPerDay,
      sex,
      currentFormulaId: effectiveFormulaId,
    });
  }

  function handleSubmit() {
    if (invalid) return;
    if (formulaChanged) {
      setWarningOpen(true);
      return;
    }
    emit();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="baby-name">Имя</Label>
        <Input
          id="baby-name"
          type="text"
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="baby-birth">Дата рождения</Label>
        <Input
          id="baby-birth"
          type="datetime-local"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="baby-weight">Вес при рождении, г</Label>
        <Input
          id="baby-weight"
          type="number"
          min={100}
          max={10000}
          inputMode="numeric"
          value={birthWeightGrams}
          onChange={(e) => setBirthWeightGrams(Number(e.target.value))}
        />
      </div>
      <div className="space-y-2">
        <Label>Пол</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full"
          value={sex}
          onValueChange={(v) => {
            if (v === "male" || v === "female") setSex(v);
          }}
        >
          <ToggleGroupItem value="male" className="flex-1">
            Мальчик
          </ToggleGroupItem>
          <ToggleGroupItem value="female" className="flex-1">
            Девочка
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor="baby-formula">Смесь</Label>
        <select
          id="baby-formula"
          className="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          value={effectiveFormulaId ?? ""}
          disabled={formulasQuery.isLoading || formulas.length === 0}
          onChange={(e) => {
            setFormulaTouched(true);
            setFormulaId(e.target.value || null);
          }}
        >
          {formulas.map((f) => (
            <option key={f._id} value={f._id}>
              {f.brand ? `${f.brand} — ${f.name}` : f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="baby-feedings">Желаемое число кормлений</Label>
        <Input
          id="baby-feedings"
          type="number"
          min={1}
          max={24}
          inputMode="numeric"
          value={feedingsPerDay}
          onChange={(e) => setFeedingsPerDay(Number(e.target.value))}
        />
        <Muted>
          Используется, если попадает в рекомендованный для возраста диапазон;
          иначе приложение возьмёт возрастную рекомендацию.
        </Muted>
      </div>
      {submitError && <FormError>{submitError}</FormError>}
      <Button
        type="button"
        className="w-full"
        onClick={handleSubmit}
        disabled={invalid || isPending}
      >
        {isEdit ? "Сохранить" : "Создать"}
      </Button>

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
                emit();
              }}
            >
              Сменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
