"use client";

import { useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FormError } from "@/components/ui/typography";
import { getBrowserTz } from "@/lib/time/browserTz";

type Props = {
  onSubmit: (data: {
    name: string;
    birthDate: Date;
    birthWeightGrams: number;
    feedingsPerDay: number;
    sex: "male" | "female";
  }) => void;
  isPending?: boolean;
  submitError?: string | null;
  tz: string;
};

export function BabyForm({ onSubmit, isPending, submitError, tz }: Props) {
  const effectiveTz = getBrowserTz(tz);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthWeightGrams, setBirthWeightGrams] = useState<number>(3400);
  const [feedingsPerDay, setFeedingsPerDay] = useState<number>(8);
  const [sex, setSex] = useState<"male" | "female">("male");

  const invalid =
    name.trim().length < 1 ||
    !birthDate ||
    birthWeightGrams <= 0 ||
    feedingsPerDay < 1 ||
    feedingsPerDay > 24;

  function handleSubmit() {
    if (invalid) return;
    onSubmit({
      name: name.trim(),
      birthDate: fromZonedTime(birthDate, effectiveTz),
      birthWeightGrams,
      feedingsPerDay,
      sex,
    });
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
        <Label htmlFor="baby-feedings">Кормлений в день</Label>
        <Input
          id="baby-feedings"
          type="number"
          min={1}
          max={24}
          inputMode="numeric"
          value={feedingsPerDay}
          onChange={(e) => setFeedingsPerDay(Number(e.target.value))}
        />
      </div>
      {submitError && <FormError>{submitError}</FormError>}
      <Button
        type="button"
        className="w-full"
        onClick={handleSubmit}
        disabled={invalid || isPending}
      >
        Создать
      </Button>
    </div>
  );
}
