FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend --prod --ignore-scripts

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY frontend/ frontend/
RUN pnpm install --frozen-lockfile --filter frontend
RUN cd frontend && pnpm build

FROM node:24-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S navi -u 1001
WORKDIR /app

COPY --from=build /app/frontend/.output ./.output
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY --from=deps /app/node_modules/.pnpm /app/node_modules/.pnpm

RUN rm -rf /root/.cache /opt/yarn* /usr/local/lib/node_modules/npm

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

USER navi

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000 > /dev/null || exit 1

CMD ["node", ".output/server/index.mjs"]
