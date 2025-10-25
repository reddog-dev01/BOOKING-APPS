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
  && mkdir -p apps/api/.output/node_modules \
  && if [ -d node_modules/.prisma ]; then \
    cp -a node_modules/.prisma apps/api/.output/node_modules/ \
    && if [ -d apps/api/.output/node_modules/.pnpm ]; then \
      find apps/api/.output/node_modules/.pnpm -maxdepth 1 -type d -name '@prisma+client@*' -exec \
        sh -c 'pkg_dir="$1/node_modules"; rm -rf "${pkg_dir}/.prisma"; mkdir -p "${pkg_dir}"; cp -a apps/api/.output/node_modules/.prisma "${pkg_dir}/"' sh {} \; \
    ; fi \
  else \
    echo 'Skipping Prisma binary copy; node_modules/.prisma not found'; \
  fi

RUN if [ -d node_modules/.prisma ]; then \
    test -f node_modules/.prisma/client/default.js \
    && test -f apps/api/.output/node_modules/.prisma/client/default.js; \
  else \
    echo 'Skipping Prisma binary validation; node_modules/.prisma not found'; \
  fi

# ---- runtime stage ----
FROM node:20-alpine AS run
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

RUN corepack enable pnpm

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/apps/api/.output/ ./
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/packages/db/prisma ./packages/db/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
