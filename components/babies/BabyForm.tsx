"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onSubmit: (data: {
    name: string;
    birthDate: string;
    birthWeightGrams: number;
    feedingsPerDay: number;
  }) => void;
  isPending?: boolean;
  submitError?: string | null;
};

export function BabyForm({ onSubmit, isPending, submitError }: Props) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthWeightGrams, setBirthWeightGrams] = useState<number>(3400);
  const [feedingsPerDay, setFeedingsPerDay] = useState<number>(8);

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
      birthDate,
      birthWeightGrams,
      feedingsPerDay,
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
      {submitError && (
        <p className="text-xs text-destructive">{submitError}</p>
      )}
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
