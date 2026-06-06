# Multi-stage build for @leon/api in a pnpm monorepo.
# Build context MUST be the repo root (see fly.toml build.dockerfile):
# tsup inlines the @leon/* workspace packages, so their sources and the shared
# lockfile have to be present at build time.

# ---- base: pinned node + pnpm via corepack -------------------------------
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Pin pnpm to the monorepo's packageManager so installs match the lockfile.
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /repo

# ---- deps: install the @leon/api dependency subtree ----------------------
# Copy only manifests first so this layer is cached until a package.json or the
# lockfile changes (not on every source edit).
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Every workspace package referenced in @leon/api's dependency graph needs its
# manifest present, or --frozen-lockfile won't resolve. api/domain/schemas all
# devDepend on @leon/{typescript,eslint}-config, so copy all four manifests.
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
# --filter ...@leon/api limits the install to api + its workspace deps, so the
# heavy web/mobile trees are never fetched.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@leon/api..."

# ---- build: compile to a single bundled dist/main.js ---------------------
FROM deps AS build
COPY apps/api apps/api
# Copy the whole packages/ tree (tiny): domain+schemas are inlined by tsup, and
# typescript-config/base.json is resolved via tsconfig "extends" at build time.
COPY packages packages
RUN pnpm --filter "@leon/api" build
# `pnpm deploy` produces a self-contained node_modules (prod deps only),
# resolving the workspace: protocol so the runtime stage needs no monorepo.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter "@leon/api" deploy --prod --legacy /app

# ---- runtime: slim image with just dist + prod node_modules --------------
FROM node:20-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
EXPOSE 8080
CMD ["node", "dist/main.js"]
