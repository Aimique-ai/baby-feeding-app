/**
 * Реестр стратегий расчёта суточной цели (PRD §5.5).
 *
 * После перехода на энергетическую модель остаётся единственная стратегия
 * `energy`. Паттерн именованной стратегии сохранён как шов под будущие
 * clinician-режимы; сам расчёт живёт в target.ts (computeTarget).
 */

export type StrategyId = "energy";

export interface PlanningStrategy {
  id: StrategyId;
  label: string;
}

export const STRATEGIES: Record<StrategyId, PlanningStrategy> = {
  energy: {
    id: "energy",
    label: "Энергетическая модель (WHO/FAO/UNU) + неонатальная титрация",
  },
};

export const ACTIVE_STRATEGY_ID: StrategyId = "energy";
