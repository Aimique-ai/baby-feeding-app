# leon-app

pnpm monorepo for the Leon baby-tracking app.

## Structure

- `apps/web` — frontend (React Router v7).
- `apps/api` — backend API (Hono, Mongoose/MongoDB).
- `packages/*` — shared code: `schemas`, `contracts`, `domain` (plus `eslint-config`, `typescript-config`).

## Development

Run the two dev servers (separate terminals):

```bash
pnpm --filter @leon/api dev
pnpm --filter @leon/web dev
```

## Ops runbook

Energy-algorithm formula deploy — run in this order:

```bash
pnpm --filter @leon/api seed:formulas
pnpm --filter @leon/api backfill:baby-formula
```

## Formatting

```bash
pnpm format
```
