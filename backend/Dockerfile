# syntax=docker/dockerfile:1
#
# The API: grading engine + JSON API + the bundled dataset.
# One process, one port, no external services beyond an optional PostgreSQL.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
COPY data ./data
RUN pnpm run build

# Only what the server needs at runtime — no tsx, no typescript.
FROM node:22-alpine AS prod-deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# The dataset is evidence the app cannot run without, so it ships in the image.
# Staged through `build` rather than copied from the host context here
# directly — some remote builders (e.g. Dokploy's) intermittently fail a late
# context COPY in a fresh final stage; a COPY --from=<stage> doesn't hit that.
COPY --from=build /app/data ./data

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/api/health > /dev/null || exit 1

CMD ["node", "dist/server.js"]
