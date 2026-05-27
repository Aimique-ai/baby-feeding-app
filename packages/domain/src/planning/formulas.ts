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
