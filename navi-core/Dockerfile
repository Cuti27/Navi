FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate
WORKDIR /app

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY navi-core/package.json navi-core/
RUN pnpm install --frozen-lockfile --filter navi-core --prod

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY navi-core/ navi-core/
RUN pnpm install --frozen-lockfile --filter navi-core
RUN cd navi-core && pnpm build

FROM node:24-slim AS production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs --home-dir /app navi
WORKDIR /app/navi-core

COPY --from=build /app/navi-core/dist ./dist
COPY --from=build /app/navi-core/drizzle ./drizzle
COPY --from=build /app/navi-core/mcp.config.json ./
COPY --from=deps /app/navi-core/node_modules ./node_modules
COPY --from=deps /app/node_modules/.pnpm /app/node_modules/.pnpm

RUN mkdir -p /app/data /app/data/memory /app/data/transformers && chown -R navi:nodejs /app/data

RUN rm -rf /root/.cache /opt/yarn* /usr/local/lib/node_modules/npm

ENV NODE_ENV=production
ENV DATABASE_URL=/app/data/navi.db
ENV MEMORY_DIR=/app/data/memory
ENV STT_CACHE_DIR=/app/data/transformers
ENV FILES_DIR=/app/data/files

EXPOSE 3000

USER navi

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/src/index.js"]
