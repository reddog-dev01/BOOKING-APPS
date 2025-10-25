# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter api build
<<<<<<< HEAD
RUN pnpm --filter api deploy /app/apps/api/.output --prod --legacy
=======
RUN pnpm --filter api --prod deploy --legacy /app/apps/api/.output
>>>>>>> 1a2c7054 (chore(api): adjust Dockerfile for pnpm deploy legacy output)

# ---- runtime stage ----
FROM node:20-alpine AS run
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/apps/api/.output/ ./
COPY --from=build /app/apps/api/dist ./dist

USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
