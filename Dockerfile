# syntax=docker/dockerfile:1

# ---- Build stage: cài đủ deps (kể cả dev) và compile TS ----
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

# Cache layer: chỉ copy manifest trước để pnpm install không chạy lại khi code đổi.
# --mount=type=cache giữ pnpm store giữa các lần build (BuildKit), nhanh hơn
# tải lại toàn bộ tarball mỗi lần đổi code.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
	pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm build

# Prune devDependencies cho image chạy thật (nhanh hơn install lại từ đầu).
RUN pnpm prune --prod

# ---- Runtime stage: chỉ node_modules prod + dist ----
FROM node:22-alpine
WORKDIR /app

# dumb-init để tín hiệu Ctrl-C / docker stop đi thẳng vào node (shutdown sạch)
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# migrations + script chạy lúc khởi động container
COPY src/db/migrations ./src/db/migrations
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN chmod +x ./scripts/docker-entrypoint.sh

# Bot là Discord gateway (không có cổng HTTP): healthcheck = process còn sống.
# start-period che cho migrate/seed/deploy lúc khởi động.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
	CMD pgrep -f "node dist/index.js" > /dev/null || exit 1

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["./scripts/docker-entrypoint.sh"]
