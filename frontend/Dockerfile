# syntax=docker/dockerfile:1
#
# The UI: a Vite build served by a dependency-free node:http server.
#
# API_URL is read at RUNTIME (server.mjs renders /env.js from the environment),
# so this image is built once and can be pointed at any backend by changing the
# variable and restarting — no rebuild.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/tsconfig*.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/public ./public
COPY frontend/src ./src
COPY frontend/server.mjs ./
RUN pnpm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup -S app && adduser -S app -G app

# server.mjs uses only node: builtins, so no node_modules ships at all.
# Staged through `build` (not copied from the host context here directly) —
# some remote builders (e.g. Dokploy's) intermittently fail a late context
# COPY in a fresh final stage; a COPY --from=<stage> doesn't hit that path.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.mjs ./

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-8080}/healthz > /dev/null || exit 1

CMD ["node", "server.mjs"]
