# Google Maps & Places API key verification checklist

This checklist makes sure the server (`PLACES_API_KEY`) and browser
(`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) keys are identical across every entry point
(API, customer web, admin console, Docker Compose) so the Places proxy no longer
returns `503` because a service picked up the wrong environment variable.

## Required key strings

- **Server-side Google Places traffic** → `PLACES_API_KEY`
- **Browser Google Maps JavaScript SDK** → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Both keys are generated from the billing-enabled Google Cloud project and are
already populated inside the committed `.env` templates so Docker builds and
local runners share the same credentials out of the box. Keep the keys
restricted to the approved origins/IPs (see the screenshot in the ticket) and
update the files if Google rotates the strings.

> [!TIP]
> The Next.js Places proxy still falls back to reading `PLACES_API_KEY` from
> the committed `.env` files (`apps/web/.env.local`, `apps/api/.env`, etc.)
> whenever the process environment is empty. Export the variables in your shell
> (or IDE) so the running process, Docker containers, and tests stay in sync.

## 1. Sync the committed .env templates

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/web/.env.local.example apps/web/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local
```

Double-check the key strings inside the copied files (they should now contain
your real credentials, not placeholders):

```bash
rg --no-heading --line-number "PLACES_API_KEY" apps/api/.env apps/web/.env apps/web/.env.local apps/admin/.env.local
grep -n "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" apps/web/.env.local apps/admin/.env.local docker-compose.yml
```

## 2. Confirm Docker Compose wiring

`docker-compose.yml` injects both keys for the API and web containers. Because
the default fallback was removed, Compose will refuse to start if
`PLACES_API_KEY` is missing—ensure the key is present in your shell or
`apps/api/.env` before running the stack. If you change a key, rebuild the
affected services so the new value is baked into the container image and
runtime environment:

```bash
docker compose up -d --force-recreate api web
```

## 3. Verify running containers resolve the same values

Use the following commands to compare the keys inside running containers without
printing the raw strings. The hashes must match between services.

```bash
docker compose exec api sh -lc 'printf "%s" "$PLACES_API_KEY"' | sha256sum
docker compose exec web sh -lc 'printf "%s" "$PLACES_API_KEY"' | sha256sum
docker compose exec web sh -lc 'printf "%s" "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"' | sha256sum
```

For the admin console (which runs outside Docker in development) confirm that
`.env.local` carries the same values:

```bash
grep -n "PLACES_API_KEY" apps/admin/.env.local
grep -n "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" apps/admin/.env.local
```

If the admin app ever moves into a container, add it to `docker-compose.yml`
with the same environment entries used by the `web` service.

## 4. Smoke test the Places proxy

Start the web app and exercise the proxy route to confirm the API keys are
resolving correctly end-to-end:

```bash
pnpm --filter web dev
curl -i http://localhost:3000/api/places/autocomplete \
  -H 'content-type: application/json' \
  -d '{"input":"ho chi"}'
```

A successful configuration returns HTTP 200 with JSON predictions. HTTP 403
indicates billing or key restrictions. HTTP 503 signals a missing or mismatched
`PLACES_API_KEY`—repeat the steps above to find the mismatch.

## 5. Restart from scratch when values change

Whenever the key strings or referrer/IP allow-lists change, rebuild the
containers and restart local dev servers so every process picks up the new
values:

```bash
docker compose down
docker compose up --build -d
pnpm --filter web dev
pnpm --filter admin dev
```

Following this list guarantees that API, web, and admin always agree on the same
Google credentials, preventing inconsistent keys from triggering circuit breaker
503 responses.
