# syntax=docker/dockerfile:1.7

# ---- dependency stage ----
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/

RUN pnpm install --frozen-lockfile

# ---- build stage ----
FROM deps AS build

ARG DATABASE_URL="postgresql://booking:secret@localhost:5432/booking?schema=public"
ENV DATABASE_URL=$DATABASE_URL

COPY . .

RUN pnpm prisma:generate \
  && pnpm --filter api build \
  && pnpm --filter api deploy /app/apps/api/.output --prod --legacy \
  && install -d apps/api/.output/node_modules \
  && PRISMA_SRC="$( \
    if [ -d apps/api/node_modules/.prisma ]; then \
      printf 'apps/api/node_modules/.prisma'; \
    elif [ -d node_modules/.prisma ]; then \
      printf 'node_modules/.prisma'; \
    fi \
  )" \
  && if [ -z "$PRISMA_SRC" ]; then \
    echo 'Prisma engines were not generated; ensure `pnpm prisma:generate` succeeds.' >&2; exit 1; \
  fi \
  && cp -a "$PRISMA_SRC" apps/api/.output/node_modules/ \
  && if [ -d apps/api/.output/node_modules/.pnpm ]; then \
    find apps/api/.output/node_modules/.pnpm -maxdepth 1 -type d -name '@prisma+client@*' -exec \
      sh -c 'pkg_dir="$1/node_modules"; rm -rf "${pkg_dir}/.prisma"; mkdir -p "${pkg_dir}"; cp -a apps/api/.output/node_modules/.prisma "${pkg_dir}/"' sh {} \; \
  ; fi \
  && test -f apps/api/.output/node_modules/.prisma/client/default.js

# ---- runtime stage ----
FROM node:20-alpine AS run
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

RUN corepack enable pnpm

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/apps/api/.output/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/package.json ./package.json
COPY apps/api/nest-cli.json ./nest-cli.json

USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
