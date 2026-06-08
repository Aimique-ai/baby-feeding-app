# leon-app

pnpm monorepo for the Leon baby-tracking app.

## Structure

- `apps/web` — frontend (React Router v7, SPA / `ssr: false`).
- `apps/api` — backend API (Hono, Mongoose/MongoDB). In production it also serves the built SPA, so the whole app runs as one process on one origin.
- `packages/*` — shared code: `schemas`, `domain` (plus `eslint-config`, `typescript-config`).

## Development

Two processes (separate terminals): the API on `:8787` and the Vite dev server on `:5173` with HMR, which proxies `/api` to the API. This is dev-only — in production a single Hono process serves both.

```bash
pnpm --filter @leon/api dev   # Hono on :8787
pnpm --filter @leon/web dev   # Vite on :5173, /api proxied to :8787
```

## Deploy

One Fly app (`leon-api`) serves the SPA and the API. The root `Dockerfile` builds both (`apps/web` → static client, `apps/api` → bundle) and the runtime image serves the static client from `./client` alongside `/api/*`. Deploy from the repo root:

```bash
fly deploy   # uses ./fly.toml + ./Dockerfile (build context = repo root)
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
