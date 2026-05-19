"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  /** Пустая строка — поле очищено пользователем (валидным числом ещё не стало). */
  value: number | "";
  onChange: (v: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  decrementLabel?: string;
  incrementLabel?: string;
  className?: string;
};

export function NumberStepper({
  id,
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  decrementLabel,
  incrementLabel,
  className,
}: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  // При пустом поле кнопки −/+ отсчитывают от min: инкрементить нечего.
  const base = value === "" ? min : value;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={decrementLabel ?? `Уменьшить на ${step}`}
        onClick={() => onChange(clamp(base - step))}
      >
        −{step}
      </Button>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        className="text-center"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={incrementLabel ?? `Увеличить на ${step}`}
        onClick={() => onChange(clamp(base + step))}
      >
        +{step}
      </Button>
    </div>
  );
}
