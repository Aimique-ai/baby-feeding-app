import type { SerializedBaby } from "@leon/contracts/serialized";

export type AppVariables = {
  tz: string;
  baby: SerializedBaby;
};

export type AppEnv = { Variables: AppVariables };
