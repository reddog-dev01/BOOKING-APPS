# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable

ARG DATABASE_URL="postgresql://booking:secret@localhost:5432/booking?schema=public"
ENV DATABASE_URL=$DATABASE_URL

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma:generate \
  && pnpm --filter api build \
  && pnpm --filter api deploy /app/apps/api/.output --prod --legacy \
  && mkdir -p apps/api/.output/node_modules \
  && cp -a node_modules/.prisma apps/api/.output/node_modules/ \
  && find node_modules/.pnpm -maxdepth 1 -type d -name '@prisma+client@*' -exec \
    sh -c 'pkg="$(basename "$1")"; src="node_modules/.pnpm/${pkg}/node_modules/.prisma"; \
      dest="apps/api/.output/node_modules/.pnpm/${pkg}/node_modules"; \
      if [ -d "${src}" ]; then mkdir -p "${dest}"; cp -a "${src}" "${dest}"; fi' sh {} \;

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
