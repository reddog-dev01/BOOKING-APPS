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
   cp apps/web/.env.example apps/web/.env
   cp apps/web/.env.local.example apps/web/.env.local
   ```

   Update the copied files with your actual secrets (API keys, database URL, etc.). The API and web containers both consume
   `apps/api/.env`, so the **server-side** Google Places key defined there is shared between NestJS and Next.js server
   components. Use a *separate* browser-restricted key for the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` value in
   `apps/web/.env.local`.

   | Purpose                               | Variable                          | Key string                                                      |
   | ------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
   | Server-to-server Google Places calls  | `PLACES_API_KEY`                  | `AIzaSyB3RRbbqQKUFLsTlw_SnDa8io3bKbx2Kuo`                       |
   | Browser Google Maps JavaScript SDK    | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaSyBXyFRBYDxiB1dxiGejU70v4qTDJxpvyUQ`                       |

   The `docker-compose.yml` file now injects these keys by default so rebuilding the containers automatically wires the
   correct credentials even if the host environment is empty.

   After modifying any of the `.env` files, restart the affected services so Docker picks up the new variables:

   ```bash
   docker compose up -d --force-recreate api web
   ```

   To fetch the dedicated keys from the `inbound-object-476110-d5` project and apply the correct restrictions, run:

   ```bash
   PLACES_KEY_NAME="projects/339756545616/locations/global/keys/3ee1a3b8-875b-4a07-b25d-c6154a06657d"
   MAPS_JS_KEY_NAME="projects/339756545616/locations/global/keys/17f0c1a4-8a08-4a3b-84da-7f3055d6d9f8"

   # Retrieve the key strings
   PLACES_KEY=$(gcloud beta services api-keys get-key-string "$PLACES_KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --format="value(keyString)")
   MAPS_JS_KEY=$(gcloud beta services api-keys get-key-string "$MAPS_JS_KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --format="value(keyString)")

   echo "Server key: $PLACES_KEY"
   echo "Browser key: $MAPS_JS_KEY"

   # Apply IP allow-list restrictions to the server key (used for PLACES_API_KEY)
   gcloud services api-keys update "$PLACES_KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --allowed-ips="116.96.47.82" \
     --api-target="service=places.googleapis.com"

   # Apply HTTP referrer restrictions to the browser key (used for NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
   gcloud services api-keys update "$MAPS_JS_KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --allowed-referrers="http://localhost:3005/*,http://127.0.0.1:3005/*,https://<your-domain>/*" \
     --api-target="service=maps-backend.googleapis.com" \
     --api-target="service=places.googleapis.com"

   # (Optional) Verify the restrictions on existing key strings
   gcloud beta services api-keys lookup --key-string="$PLACES_KEY"
   gcloud beta services api-keys lookup --key-string="$MAPS_JS_KEY"

   # Persist the server key for backend requests (NestJS + Next.js server components)
   {
     echo "PLACES_API_KEY=$PLACES_KEY"
   } >> apps/api/.env
   {
     echo "PLACES_API_KEY=$PLACES_KEY"
     echo "GOOGLE_MAPS_REFERER=http://localhost:3005/"
   } >> apps/web/.env

   # Persist the browser key (HTTP referrer restricted) for the frontend bundle
   {
     echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$MAPS_JS_KEY"
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

  The API is exposed on `http://127.0.0.1:3006` and the web frontend on `http://127.0.0.1:3005` by default.

4. **Verify health checks**

   ```bash
   curl -i http://127.0.0.1:3006/healthz
   curl -I http://127.0.0.1:3005
   ```

5. **(Optional) Run Caddy for HTTPS/reverse proxy**

   ```bash
   docker compose up -d caddy
   ```

   Update `NEXT_PUBLIC_API_BASE` and `CORS_ORIGINS` to use your HTTPS domain when fronting through Caddy.

> ⚠️ Postgres data is persisted in the named volume `pg`. Always take a backup before applying new Prisma migrations.

## Local development (pnpm)

If you prefer local development outside Docker, follow the service-specific READMEs (for example `apps/api/README.md`) for setup, environment variables, and sample curl commands.

