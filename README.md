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

   To fetch and restrict the Google Maps key from the `inbound-object-476110-d5` project, run:

   ```bash
   KEY_NAME="projects/339756545616/locations/global/keys/3ee1a3b8-875b-4a07-b25d-c6154a06657d"

   # Retrieve the key string
   KEY_STRING=$(gcloud beta services api-keys get-key-string "$KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --format="value(keyString)")
   echo "$KEY_STRING"

   # Restrict usage to HTTPS/HTTP referrers and the required APIs
   gcloud services api-keys update "$KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --allowed-referrers="http://localhost:3000/*,http://127.0.0.1:3000/*,https://<your-domain>/*" \
     --api-target="service=maps-backend.googleapis.com" \
     --api-target="service=places.googleapis.com"

  # Persist the key into both API and web env files
  echo "GOOGLE_MAPS_API_KEY=$KEY_STRING" >> apps/api/.env
  {
    echo "GOOGLE_MAPS_API_KEY=$KEY_STRING"
    echo "GOOGLE_MAPS_REFERER=http://localhost:3000/"
  } >> apps/web/.env.local
   ```

   Replace `<your-domain>` with the production hostname. Regenerate the key if you need to rotate secrets.

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

