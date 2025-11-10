# syntax=docker/dockerfile:1.7

############################################
# Base: pin pnpm, Alpine, non-root        #
############################################
FROM node:20-alpine AS base
WORKDIR /app
ENV CI=1
RUN addgroup -S app && adduser -S app -G app \
  && apk add --no-cache libc6-compat \
  && corepack enable && corepack prepare pnpm@10.17.1 --activate

############################################
# Deps: cài workspace deps để build       #
############################################
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

#############################################################
# Build: Prisma generate + build Nest + deploy node_modules #
#############################################################
FROM base AS build
ARG DATABASE_URL="postgresql://booking:secret@localhost:5432/booking?schema=public"
ENV DATABASE_URL=${DATABASE_URL}
ENV PRISMA_HIDE_UPDATE_MESSAGE=1

# Dùng node_modules từ deps
COPY --from=deps /app/node_modules ./node_modules
# Copy source
COPY . .

# 1) Generate Prisma client
# 2) Build Nest -> apps/api/dist
# 3) Chuẩn hóa entry dist/main.js (nếu compiler sinh dist/src/main.js thì symlink)
# 4) Deploy node_modules gọn cho API -> apps/api/.output
RUN set -euxo pipefail; \
  pnpm exec prisma generate --schema=packages/db/prisma/schema.prisma; \
  pnpm --filter api build; \
  if [ -f apps/api/dist/main.js ]; then \
  echo "OK: apps/api/dist/main.js"; \
  elif [ -f apps/api/dist/src/main.js ]; then \
  echo "WARN: found dist/src/main.js -> symlink dist/main.js"; \
  ln -sf ./src/main.js apps/api/dist/main.js; \
  else \
  echo "ERR: No dist entry found"; \
  ls -la apps/api/dist || true; \
  exit 1; \
  fi; \
  pnpm --filter api deploy /app/apps/api/.output --prod --legacy; \
  install -d apps/api/.output/node_modules

# 5) Chép Prisma engines/client vào node_modules đã deploy
RUN set -euxo pipefail; \
  PRISMA_SRC=""; \
  for root in apps/api/node_modules node_modules; do \
  if [ -d "$root" ]; then \
  f="$(find "$root" -maxdepth 5 -type d -name '.prisma' | head -n 1 || true)"; \
  [ -n "$f" ] && PRISMA_SRC="$f" && break; \
  fi; \
  done; \
  if [ -z "$PRISMA_SRC" ]; then \
  echo 'ERR: Prisma engines were not generated; ensure prisma generate succeeded.' >&2; \
  exit 1; \
  fi; \
  cp -a "$PRISMA_SRC" apps/api/.output/node_modules/; \
  if [ -d apps/api/.output/node_modules/.pnpm ]; then \
  find apps/api/.output/node_modules/.pnpm -maxdepth 1 -type d -name '@prisma+client@*' | \
  while read -r pkg; do \
  pkg_dir="$pkg/node_modules"; \
  rm -rf "${pkg_dir}/.prisma"; \
  mkdir -p "$pkg_dir"; \
  cp -a apps/api/.output/node_modules/.prisma "$pkg_dir/"; \
  done; \
  fi; \
  test -f apps/api/.output/node_modules/.prisma/client/default.js

#####################################################################
# Runtime: chạy ở /srv (tránh bị đè nếu compose lỡ bind-mount /app)
#####################################################################
FROM node:20-alpine AS run
WORKDIR /srv
ENV NODE_ENV=production \
  PORT=3006
RUN apk add --no-cache wget ca-certificates \
  && addgroup -S app && adduser -S app -G app

# Healthcheck script
COPY apps/api/docker/healthcheck.sh /usr/local/bin/api-healthcheck
RUN chmod +x /usr/local/bin/api-healthcheck

# Payload runtime
COPY --from=build /app/apps/api/.output/node_modules ./node_modules
COPY --from=build /app/apps/api/dist           ./dist
COPY --from=build /app/packages/db/prisma      ./packages/db/prisma
COPY --from=build /app/prisma.config.ts        ./prisma.config.ts
COPY apps/api/package.json                     ./package.json
COPY apps/api/nest-cli.json                    ./nest-cli.json

USER app
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD ["/bin/sh", "/usr/local/bin/api-healthcheck"]
EXPOSE 3006
CMD ["node", "dist/main.js"]
