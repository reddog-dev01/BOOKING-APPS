# Localhost CORS & Prisma Build Playbook

_Last reviewed: 2025-11-03 (Asia/Bangkok)_

## Overview

This guide explains how the API enforces CORS for localhost development and how to build the service when CI runners cannot reach the public Prisma CDN.

## CORS architecture

- `apps/api/src/plugins/cors.ts` is a Fastify plugin that normalises origins, mirrors trusted callers, and blocks the rest with an `onRequest` guard that returns a JSON `403` without surfacing framework `500`s.
- The allow-list is seeded with `http/https://localhost|127.0.0.1:3000-3008` and can be extended via `CORS_ORIGINS`.
- Setting `CORS_ORIGINS=*` opts into wildcard behaviour (credentials still work because we echo the request origin).
- Blocked origins trigger structured log entries (`blocked CORS origin`, `blocked request by CORS policy`) to aid debugging and observability.

## Build matrix when Prisma engines cannot be downloaded

### ✅ Standard networked build

```bash
pnpm install
pnpm approve-builds prisma
pnpm -w prisma:generate
pnpm --filter api build
```

### ✅ Strategy A — Multi-stage Docker image (recommended)

Generate Prisma Client/engines in a build stage that has internet access, then copy artefacts into the runtime image.

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /app
COPY pnpm-*.yaml package.json pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm approve-builds prisma
COPY . .
RUN pnpm -w prisma:generate \
  && pnpm --filter api build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PRISMA_SKIP_POSTINSTALL_GENERATE=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/apps/api/node_modules/@prisma/client ./apps/api/node_modules/@prisma/client
EXPOSE 3006
CMD ["node", "apps/api/dist/main.js"]
```

### ✅ Strategy B — Internal Prisma mirror

1. Mirror `https://binaries.prisma.sh` to an internal object store.
2. Configure the runner:

```bash
export PRISMA_ENGINES_MIRROR=https://artifacts.internal.example.com/prisma/
pnpm -w prisma:generate
```

Reference: [Prisma engine mirror docs (checked 2025-11-03)](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/configuring-prisma-client-environment#using-a-custom-engine-binary).

### ✅ Strategy C — Cache generated artefacts

1. Cache these paths between jobs: `node_modules/.prisma/`, `apps/api/node_modules/@prisma/client/`, and the pnpm store.
2. Skip post-install generation during cached builds:

```bash
export PRISMA_SKIP_POSTINSTALL_GENERATE=1
pnpm --filter api build
```

## Smoke test

```bash
curl -i -X OPTIONS 'http://127.0.0.1:3006/pricing/quote' \
  -H 'Origin: http://localhost:3008' \
  -H 'Access-Control-Request-Method: POST'
```

A `204` response with `Access-Control-Allow-Origin: http://localhost:3008` confirms the configuration.

> ℹ️ `/pricing/quote` only accepts `POST` requests. Opening the endpoint in a browser (GET) will return a `404`, which is expected.

## Observability

- Track Fastify logs for `blocked CORS origin` and `blocked request by CORS policy`.
- Target ≥ 99.5% success for `OPTIONS` requests hitting `/pricing/quote`.
- Add alerts on spikes of `403 CORS_ORIGIN_BLOCKED` responses from expected origins.

## Troubleshooting

- If the browser still reports `Not allowed by CORS`, inspect the API logs for the `blocked request by CORS policy` entry. Confirm the offending origin is included in `CORS_ORIGINS` (comma-separated, no spaces) or falls within the localhost defaults.
- When running `pnpm --filter api dev`, ensure Prisma engines were generated beforehand (see build matrix above); otherwise, `pnpm exec prisma generate` will fail and the Fastify server will never start.
