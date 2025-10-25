# syntax=docker/dockerfile:1.7

# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /work

RUN corepack enable \
  && corepack prepare pnpm@10.17.1 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json

RUN pnpm install --frozen-lockfile

# ---- build stage ----
FROM deps AS build
WORKDIR /work

COPY . .

ARG NEXT_PUBLIC_API_BASE
ARG INTERNAL_API_BASE=http://api:3006
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_QUOTE_PATH=/pricing/quote
ARG NEXT_PUBLIC_BOOKINGS_PATH=/bookings
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV INTERNAL_API_BASE=${INTERNAL_API_BASE}
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
ENV NEXT_PUBLIC_QUOTE_PATH=${NEXT_PUBLIC_QUOTE_PATH}
ENV NEXT_PUBLIC_BOOKINGS_PATH=${NEXT_PUBLIC_BOOKINGS_PATH}

RUN pnpm --filter web build

# ---- runtime stage ----
FROM node:20-alpine AS run
ARG INTERNAL_API_BASE=http://api:3006
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV INTERNAL_API_BASE=${INTERNAL_API_BASE}

COPY --from=build /work/apps/web/.next/standalone ./
COPY --from=build /work/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /work/apps/web/public ./apps/web/public
COPY apps/web/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz >/dev/null || exit 1

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
