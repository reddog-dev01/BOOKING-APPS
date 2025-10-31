# Google Places Autocomplete Runbook

This runbook consolidates the operational steps required to unblock the `apps/web` Places autocomplete proxy when it returns `403 BILLING_DISABLED` or `503` responses. Follow every section in order; skipping a step usually leaves the proxy in a degraded state.

## 1. Prerequisites

- You must have owner or billing admin permissions on the Google Cloud project that hosts the Places API key (`projects/339756545616`).
- Install the Google Cloud CLI (`gcloud`) and authenticate with `gcloud auth login`.
- Ensure `pnpm` is available locally (v10+ recommended).

## 2. Enable billing for the project

```bash
PROJECT_ID="339756545616"
# Inspect the current billing status
gcloud beta billing projects describe "$PROJECT_ID" --format='value(billingEnabled)'

# If the command prints anything other than "True", link the project to an active billing account
BILLING_ACCOUNT_ID="XXXXXX-XXXXXX-XXXXXX" # replace with your billing account ID

gcloud beta billing projects link "$PROJECT_ID" \
  --billing-account="$BILLING_ACCOUNT_ID"
```

Wait 1–3 minutes after linking. Google propagates billing changes asynchronously; API calls can continue to return `BILLING_DISABLED` until propagation finishes.

## 3. Smoke-test Places directly with the server key

```bash
PLACES_KEY="<your-server-key-value>"

curl -sS -X POST "https://places.googleapis.com/v1/places:autocomplete" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $PLACES_KEY" \
  -d '{"input":"ha noi","languageCode":"vi"}' | jq
```

- HTTP 200 with `suggestions` → billing is active and the key has the required scope.
- HTTP 403 with `API keys with referer restrictions cannot be used with this API.` → you copied the browser key instead of the server key.
- HTTP 403 with `BILLING_DISABLED` → wait a few more minutes and retry step 2.

## 4. Provide the key to the Next.js API route

### Local development

Create `apps/web/.env.local` if it does not exist and add:

```bash
PLACES_API_KEY=$PLACES_KEY
```

Restart the dev server afterwards:

```bash
pnpm --filter web dev
```

### Docker Compose

Add the environment variable to the `web` service:

```yaml
services:
  web:
    environment:
      PLACES_API_KEY: ${PLACES_API_KEY:?set it}
```

Export the variable in your shell before running `docker compose up`:

```bash
export PLACES_API_KEY="$PLACES_KEY"
docker compose up -d web
```

## 5. Verify the proxy endpoint

```bash
WEB_PORT=3005 # adjust if your dev server runs on a different port
curl -i "http://localhost:${WEB_PORT}/api/places/autocomplete" \
  -H 'content-type: application/json' \
  -d '{"input":"ha noi","languageCode":"vi"}'
```

Expected outcomes:

- HTTP 200 + JSON body with `predictions` → all good.
- HTTP 403 + JSON body with `docsPath` and `hints` → billing/key issue persisted; follow the hints and retry.
- HTTP 429 → you exceeded the local rate limit (wait 15 seconds and try again).

## 6. See also

- [`docs/google-key-verification.md`](./google-key-verification.md) — detailed checklist for rotating and auditing Google API keys across the monorepo.
- `apps/web/app/api/places/autocomplete/route.ts` — the proxy handler returning the structured hints.
- `apps/web/lib/server/googlePlacesRest.ts` — shared client handling Places responses and deriving troubleshooting metadata.
