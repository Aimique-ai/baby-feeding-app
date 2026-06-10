import { z } from "zod";
import { objectIdString } from "./objectId";

export const timerStateSchema = z.object({
  startedAt: z.iso.datetime().nullable(),
});

export type TimerState = z.infer<typeof timerStateSchema>;

export const timerStopSchema = z.object({
  startAt: z.iso.datetime(),
  durationMin: z.number().int(),
});

export type TimerStop = z.infer<typeof timerStopSchema>;

export const timersSnapshotSchema = z.array(
  z.object({
    babyId: objectIdString,
    startedAt: z.iso.datetime(),
  }),
);

export type TimersSnapshot = z.infer<typeof timersSnapshotSchema>;

export const timerEventSchema = z.object({
  babyId: objectIdString,
  type: z.enum(["started", "stopped"]),
  startedAt: z.iso.datetime().optional(),
});

export type TimerEvent = z.infer<typeof timerEventSchema>;
