# Conventions

## Runtime

All DB-touching code runs on the Node.js runtime in the Hono API (`apps/api`). The single Mongoose connection helper lives at `apps/api/src/db/mongo.ts` (`dbConnect`) and memoizes the connection. Models are registered via `apps/api/src/db/registerModel.ts` to stay safe across reloads.

## Time

All conversion from a calendar day (`dateISO`, `tz`) to UTC instant boundaries goes through a single module: `packages/domain/src/time/dayRange.ts`. Never inline timezone math elsewhere — call `dayRange()`. This keeps day-boundary semantics (which feedings belong to which calendar day) consistent across the API and UI.

## Numbers

Milliliter values are rounded half-up at the presentation boundary via helpers in `apps/web/app/lib/format/` (`ml.ts`, `time.ts`). Domain/storage keeps full precision; only display rounds. Never round in storage or mid-calculation.

## React Query cache shape

Query keys are tuples built by helpers in `apps/web/app/components/day-view/feedingsKey.ts`. The cache is keyed by `[entity, babyId, dateISO, tz]`. Invalidate by prefix when mutating.
