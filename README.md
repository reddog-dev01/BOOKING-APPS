# Booking Platform Monorepo

This repository contains the services for the booking platform:

- `apps/api` – NestJS API that powers pricing, bookings, settings, and vehicle management.
- `apps/web` – Next.js frontend for customer bookings.
- `apps/admin` – Admin console (development via pnpm).
- `packages/db` – Prisma schema and seed scripts shared across services.

The repository uses pnpm workspaces and TypeScript across all packages.

## Install dependencies

```bash
pnpm install
```

> [!NOTE]
> pnpm v10 blocks packages with postinstall/build scripts until they are explicitly whitelisted. The workspace `.npmrc` now
> allows the build steps required by Prisma, NestJS, Sharp, and related tooling so `pnpm install` and the Docker builds can run
> `prisma generate` and other necessary setup automatically.

## Production-style Docker quickstart

The project ships with a multi-service `docker-compose.yml` and dedicated Dockerfiles for the API and web applications. This setup mirrors production expectations: each service is built via multi-stage Dockerfiles, runs as a non-root user, and is orchestrated together with Postgres and Caddy.

1. **Prepare environment files**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   cp apps/web/.env.local.example apps/web/.env.local
   cp apps/admin/.env.local.example apps/admin/.env.local
   ```

   Update the copied files with your actual secrets (API keys, database URL, etc.). The API and web containers both consume
   `apps/api/.env`, so the **server-side** Google Places key defined there is shared between NestJS and Next.js server
   components. Use a *separate* browser-restricted key for the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` value in
   `apps/web/.env.local` and `apps/admin/.env.local`.

  The web app’s Places proxy now falls back to these `.env` files if the process environment is empty, which prevents
  `503 Service Unavailable` responses when you forget to export `PLACES_API_KEY` before starting `pnpm --filter web dev`.
  Still keep the shell variables in sync so Docker, local scripts, and test runners resolve the same credentials. If the
  proxy responds with `503` and the body contains `Google Places yêu cầu bật Billing cho dự án chứa API key`, the
  upstream Places API rejected the request because billing is disabled on the Google Cloud project—follow the billing
  troubleshooting steps below and then retry after the 10‑minute circuit breaker window expires.

  The quick audit checklist in [`docs/google-key-verification.md`](docs/google-key-verification.md)
  walks through verifying that every service (.env files, Docker Compose, and running
  containers) resolves the same key strings end-to-end.

  > [!IMPORTANT]
  > Billing-enabled Places (`PLACES_API_KEY`) and Maps JavaScript
  > (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) keys are now pre-populated in the
  > committed `.env` templates for local development. Keep the Google Cloud
  > console restrictions in sync with the configured dev origins (e.g.
  > `http://localhost:3005/*`, `http://127.0.0.1:3005/*`, `http://localhost:3007/*`).
  > Update the values if the credentials rotate so Docker and local runners pick
  > up the new strings immediately.

   **Where these variables are consumed**

   - `apps/web/lib/server/googlePlacesRest.ts` injects `PLACES_API_KEY` as the `X-Goog-Api-Key` header for the Places REST
     calls that power `/api/places/autocomplete` and `/api/places/details`.
   - `apps/web/Dockerfile` exposes `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to the browser bundle so client components can load the
     Maps JavaScript SDK.
   - `apps/api/src/infra/maps/map.util.ts` reuses the same server key for NestJS flows that talk directly to Google.

  If those files resolve the wrong key, double-check the `.env` files above or the Docker Compose overrides.

  The `docker-compose.yml` file requires the keys to be set (via shell env vars or
  `apps/api/.env`) before the stack will start. Rebuild the containers after you
  rotate credentials so the runtime picks up the new values.

   After modifying any of the `.env` files, restart the affected services so Docker picks up the new variables:

   ```bash
   docker compose up -d --force-recreate api web
   ```

   Export the project and key resource names up-front so every command has the context it needs. The `gcloud beta billing
   projects describe` command in particular fails with `could not parse resource []` when `PROJECT_ID` is unset, so double
   check these values before continuing.

   ```bash
   export PROJECT_ID="inbound-object-476110-d5"
   export PLACES_KEY_NAME="projects/339756545616/locations/global/keys/649d7705-6472-4b48-8605-09230a504b41"
   export MAPS_JS_KEY_NAME="projects/339756545616/locations/global/keys/3ee1a3b8-875b-4a07-b25d-c6154a06657d"
   ```

   To fetch the dedicated keys from the `inbound-object-476110-d5` project and apply the correct restrictions, run:

   ```bash
   # Ensure the gcloud beta component is available
   gcloud components install beta --quiet

   # Retrieve the key strings
   PLACES_KEY=$(gcloud beta services api-keys get-key-string "$PLACES_KEY_NAME" \
     --project="$PROJECT_ID" \
     --format="value(keyString)")
   MAPS_JS_KEY=$(gcloud beta services api-keys get-key-string "$MAPS_JS_KEY_NAME" \
     --project="$PROJECT_ID" \
     --format="value(keyString)")

   echo "Server key (PLACES_API_KEY): $PLACES_KEY"
   echo "Browser key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY): $MAPS_JS_KEY"

   ALLOWED_IPS="<replace-with-your-public-ip>/32"

   # Apply IP allow-list restrictions to the server key (used for PLACES_API_KEY)
   gcloud beta services api-keys update "$PLACES_KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --allowed-ips="$ALLOWED_IPS" \
     --api-target="service=places.googleapis.com"

   # Apply HTTP referrer restrictions to the browser key (used for NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
   gcloud beta services api-keys update "$MAPS_JS_KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --allowed-referrers="http://localhost:3005/*,http://127.0.0.1:3005/*,https://<your-domain>/*" \
     --api-target="service=maps-backend.googleapis.com" \
     --api-target="service=places.googleapis.com"

   # (Optional) Verify the restrictions on existing key strings
   gcloud beta services api-keys lookup --key-string="$PLACES_KEY"
   gcloud beta services api-keys lookup --key-string="$MAPS_JS_KEY"

   # Persist the server key for backend requests (NestJS + Next.js server components)
   cat <<EOF > apps/api/.env
   PORT=3006
   CORS_ORIGINS=http://localhost:3005,http://127.0.0.1:3005,http://localhost:3007,http://127.0.0.1:3007
   RL_MAX=120
   RL_WINDOW=1 minute
   RL_ALLOWLIST=
   PLACES_API_KEY=$PLACES_KEY
   DATABASE_URL=postgresql://booking:secret@db:5432/booking?schema=public
   EOF

   cat <<EOF > apps/web/.env
   PLACES_API_KEY=$PLACES_KEY
   GOOGLE_MAPS_REFERER=http://localhost:3005/
   EOF

   # Persist the browser key (HTTP referrer restricted) for the frontend bundle
   cat <<EOF > apps/web/.env.local
   PLACES_API_KEY=$PLACES_KEY
   GOOGLE_MAPS_REFERER=http://localhost:3005/
   NEXT_PUBLIC_API_BASE=http://127.0.0.1:3006
   INTERNAL_API_BASE=http://127.0.0.1:3006
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$MAPS_JS_KEY
   NEXT_PUBLIC_QUOTE_PATH=/pricing/quote
   NEXT_PUBLIC_BOOKINGS_PATH=/bookings
   EOF
   ```

   Replace `<your-domain>` with the production hostname. Regenerate the key if you need to rotate secrets.

   > 💡 Google Places APIs require billing to be enabled on the Cloud project that owns the keys. If you see `This API method
   > requires billing to be enabled`, visit the [Google Cloud Billing page](https://console.cloud.google.com/billing) and link the
   > project before retrying. Also review your IP/referrer allow-lists if requests still return HTTP 403. The Places proxy caches
   > billing failures for ten minutes, so restart the dev server or wait for the cache to expire after enabling billing.

   ### Verify the keys and troubleshoot 403/503s

   1. **Check restrictions in Google Cloud Console**

      - Server key (`PLACES_API_KEY`): Application restriction = `IP addresses`; add your outbound public IPs (for Docker
        Compose this is the host machine). API restriction = `Places API`.
      - Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): Application restriction = `Websites`; add development origins such as
        `http://localhost:3005/*` and production domains. API restriction = `Maps JavaScript API` + `Places API`.

      If you run the web app on a different origin (for example `http://localhost:3000` or HTTPS), update the allow-list to
      match the exact scheme, host, and port or Google will respond with `403 PERMISSION_DENIED`.

      ```bash
      # Inspect the current browser key restrictions and confirm the allowedReferrers list
      gcloud services api-keys describe "$MAPS_JS_KEY_NAME" \
        --project="$PROJECT_ID" \
        --format='get(restrictions.browserKeyRestrictions.allowedReferrers)'

      # Add or replace referrers to match your dev server, e.g. localhost:3000 over HTTP and HTTPS
      gcloud beta services api-keys update "$MAPS_JS_KEY_NAME" \
        --project="$PROJECT_ID" \
        --allowed-referrers="http://localhost:3000/*,https://localhost:3000/*" \
        --api-target="service=maps-backend.googleapis.com" \
        --api-target="service=places.googleapis.com"
      ```

   2. **Ensure billing is active**

      ```bash
      gcloud beta billing projects describe inbound-object-476110-d5 \
        --project=inbound-object-476110-d5 \
        --format='value(billingAccountName)'
      ```

      The command must return a billing account ID. If it is blank, enable billing from the Cloud Console before retrying API
      calls.

   3. **Recognize the `/api/places/autocomplete` 503 message**

      The Next.js route translates Google’s `FAILED_PRECONDITION` billing error into an HTTP 503 with the message `Google
      Places yêu cầu bật Billing cho dự án chứa API key. Vào Google Cloud Console → Billing, liên kết dự án rồi thử lại.`
      After enabling billing, restart the dev server (or wait ten minutes for the cache to clear) before reissuing the
      request.

   4. **Smoke test the Places proxy**

      ```bash
      # Terminal 1 – start the web app so the Next.js route handlers run
      pnpm --filter web dev

      # Terminal 2 – exercise the autocomplete proxy
      curl -i http://localhost:3000/api/places/autocomplete \
        -H 'content-type: application/json' \
        -d '{"input":"ho chi"}'
      ```

      A healthy configuration returns HTTP 200 with JSON predictions. HTTP 403 indicates either billing is still disabled or the
      key restrictions do not match the incoming IP/referrer shown in the server logs.

   5. **Inspect server logs** – Next.js logs the `places.autocomplete_failed` entries with the exact HTTP status from Google.
      Use them to match failing requests to the corresponding key restriction.

   6. **Confirm environment wiring (optional)** – If you need to prove that a Docker container or `.env` file carries the same
      key string that Cloud Console shows, compare their SHA-256 hashes without printing the raw key:

      ```bash
      export MAPS_JS_KEY=$(gcloud beta services api-keys get-key-string "$MAPS_JS_KEY_NAME" \
        --project="$PROJECT_ID" \
        --format='value(keyString)')

      # Hash from Google Cloud
      printf '%s' "$MAPS_JS_KEY" | sha256sum

      # Hash from the running web container
      docker compose exec web sh -lc 'printf "%s" "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"' | sha256sum
      ```

      Matching hashes confirm the value is wired correctly without leaking the secret.

2. **Build the containers**

   ```bash
   docker compose build api web
   ```

3. **Start the stack**

   ```bash
   docker compose up -d db api web
   ```

   The API is exposed on `http://127.0.0.1:3006` and the web frontend on `http://127.0.0.1:3005` by default. If you need the
   consolidated reverse proxy on port 80, start Caddy alongside the core services:

   ```bash
   docker compose up -d caddy
   ```

   Caddy listens on `http://127.0.0.1:80` and `https://127.0.0.1:443` and forwards `/api/*` routes to the NestJS API while all
   other paths hit the Next.js frontend.

4. **Verify health checks**

   ```bash
   curl -i http://127.0.0.1:3006/healthz
   curl -I http://127.0.0.1:3005
   ```

5. **(Optional) Enable HTTPS via Caddy**

   If you expose the stack publicly or need local HTTPS testing, keep the Caddy service running and update
   `NEXT_PUBLIC_API_BASE` and `CORS_ORIGINS` to use your HTTPS domain when fronting through Caddy.

> ⚠️ Postgres data is persisted in the named volume `pg`. Always take a backup before applying new Prisma migrations.

## Local development (pnpm)

If you prefer local development outside Docker, follow the service-specific READMEs (for example `apps/api/README.md`) for setup, environment variables, and sample curl commands.

