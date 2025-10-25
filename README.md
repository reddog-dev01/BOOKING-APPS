# Booking Platform Monorepo

This repository contains the services for the booking platform:

- `apps/api` – NestJS API that powers pricing, bookings, settings, and vehicle management.
- `apps/web` – Next.js frontend for customer bookings.
- `apps/admin` – Admin console (development via pnpm).
- `packages/db` – Prisma schema and seed scripts shared across services.

The repository uses pnpm workspaces and TypeScript across all packages.

## Production-style Docker quickstart

The project ships with a multi-service `docker-compose.yml` and dedicated Dockerfiles for the API and web applications. This setup mirrors production expectations: each service is built via multi-stage Dockerfiles, runs as a non-root user, and is orchestrated together with Postgres and Caddy.

1. **Prepare environment files**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.local.example apps/web/.env.local
   ```

   Update the copied files with your actual secrets (API keys, database URL, etc.).

2. **Build the containers**

   ```bash
   docker compose build api web
   ```

3. **Start the stack**

   ```bash
   docker compose up -d db api web
   ```

   The API is exposed on `http://127.0.0.1:3001` and the web frontend on `http://127.0.0.1:3000` by default.

4. **Verify health checks**

   ```bash
   curl -i http://127.0.0.1:3001/healthz
   curl -I http://127.0.0.1:3000
   ```

5. **(Optional) Run Caddy for HTTPS/reverse proxy**

   ```bash
   docker compose up -d caddy
   ```

   Update `NEXT_PUBLIC_API_BASE` and `CORS_ORIGINS` to use your HTTPS domain when fronting through Caddy.

> ⚠️ Postgres data is persisted in the named volume `pg`. Always take a backup before applying new Prisma migrations.

## Local development (pnpm)

If you prefer local development outside Docker, follow the service-specific READMEs (for example `apps/api/README.md`) for setup, environment variables, and sample curl commands.

