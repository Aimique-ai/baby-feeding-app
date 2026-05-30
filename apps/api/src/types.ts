import type { Baby } from "@leon/schemas/baby";

export type AppVariables = {
  tz: string;
  baby: Baby;
};

export type AppEnv = { Variables: AppVariables };
