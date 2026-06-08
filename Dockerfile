# Build context must be the repo root. Serves both @leon/web (static) and @leon/api.

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@leon/api..." --filter "@leon/web..."

FROM deps AS build
COPY apps/api apps/api
COPY apps/web apps/web
COPY packages packages
RUN pnpm --filter "@leon/web" build
RUN pnpm --filter "@leon/api" build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter "@leon/api" deploy --prod --legacy /app

FROM node:20-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/web/build/client ./client
EXPOSE 8080
CMD ["node", "dist/main.js"]
