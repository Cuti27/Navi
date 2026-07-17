FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache python3 make g++ sqlite
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY navi-core/package.json navi-core/
RUN pnpm install --frozen-lockfile --filter navi-core --prod

FROM base AS build
RUN apk add --no-cache python3 make g++ sqlite
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY navi-core/ navi-core/
RUN pnpm install --frozen-lockfile --filter navi-core
RUN cd navi-core && pnpm build

FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN addgroup -g 1001 -S nodejs && adduser -S navi -u 1001
WORKDIR /app/navi-core

COPY --from=build /app/navi-core/dist ./dist
COPY --from=build /app/navi-core/drizzle ./drizzle
COPY --from=build /app/navi-core/mcp.config.json ./
COPY --from=deps /app/navi-core/node_modules ./node_modules

RUN mkdir -p /app/data && chown -R navi:nodejs /app/data

ENV NODE_ENV=production
ENV DATABASE_URL=/app/data/navi.db
ENV MEMORY_DIR=/app/data/memory

EXPOSE 3000

USER navi

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/src/index.js"]
