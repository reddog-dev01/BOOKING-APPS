# Booking API (NestJS)

This service powers the pricing and booking flows for the Booking platform. It exposes REST endpoints for generating price quotes and creating bookings while enforcing validation, rate limiting, and structured logging.

## Features

- NestJS + Fastify stack with global `ValidationPipe` (`whitelist`, `transform`).
- JSON logging via Fastify/Pino.
- CORS allow-list derived from `CORS_ORIGINS` (CSV) with sensible localhost fallbacks.
- Lightweight in-memory rate limiter configured through `RL_MAX`, `RL_WINDOW`, and `RL_ALLOWLIST`.
- Graceful shutdown (SIGINT/SIGTERM) with Prisma disconnection.
- Pricing module supporting `/pricing/quote` and `/price/quote` for both road and airport trips.
- Booking module providing `/bookings` creation with quote expiry validation.
- Settings and vehicle management endpoints used by the admin dashboard.
- `/healthz` endpoint for liveness probes.

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for running Postgres via `docker compose`)

### Environment variables

Copy the project level `.env` (or create one) that contains at least:

```env
PORT=3006
CORS_ORIGINS=http://localhost:3005,http://127.0.0.1:3005,http://localhost:3007,http://127.0.0.1:3007
DATABASE_URL=postgresql://booking:secret@localhost:5432/booking?schema=public
RL_MAX=120
RL_WINDOW=1 minute
RL_ALLOWLIST=
```

> ℹ️ When the API runs inside Docker, set the `DATABASE_URL` host to `db` instead of `localhost`.

## Local development

1. Install dependencies (run once):
   ```bash
   pnpm install
   ```
2. Start Postgres:
   ```bash
   docker compose up -d db
   ```
3. Generate the Prisma client and apply the existing schema:
   ```bash
   export PRISMA_SCHEMA=packages/db/prisma/schema.prisma
   pnpm -w prisma generate --schema "$PRISMA_SCHEMA"
   ```
4. Seed reference data (airports, routes, price policies, etc.):
   ```bash
   pnpm -w prisma db seed
   ```
5. Launch the API on port 3006:
   ```bash
   pnpm --filter api dev
   ```

The Fastify logger prints JSON lines to STDOUT. When the API starts successfully you should see a message similar to:

```json
{"level":"info","time":"2025-10-24T11:00:00.000Z","port":3006,"msg":"API server is listening"}
```

If the API cannot reach Postgres you will receive a single log entry like:

```text
[Nest] ... ERROR [PrismaService] Failed to connect to the database: Can't reach database server at `localhost:5432`
```

Ensure Postgres is running (`docker compose up -d db`) and that `DATABASE_URL` points to the correct host before retrying.

## Testing the endpoints

After the API starts, you can issue sample requests:

```bash
now=$(date -Iseconds)
# Create an airport quote (aliases: /pricing/quote or /price/quote)
curl -i -H 'content-type: application/json' \
  -d '{"tripType":"AIRPORT","vehicleTypeId":1,"startAt":"'"$now"'","roundTrip":false,"withVat":true,"vatPct":10,"fromText":"Noi Bai","toText":"Old Quarter","fromLat":21.214,"fromLng":105.806,"toLat":21.033,"toLng":105.851,"airportCode":"HAN","direction":"IN"}' \
  http://localhost:3006/pricing/quote

# Use the returned quote id to create a booking
QUOTE_ID="<replace-with-quote-id>"
curl -i -H 'content-type: application/json' \
  -d '{"quoteId":"'"$QUOTE_ID"'","customerName":"A","customerPhone":"+84900000000","fromText":"Noi Bai","toText":"Old Quarter"}' \
  http://localhost:3006/bookings
```

Validation errors return HTTP 400 responses with the standard NestJS validation payload that lists the failing fields.

## Production notes

- Run `pnpm --filter api build` and start with `pnpm --filter api start:prod`.
- Configure CORS origins, rate limit values, and logging level via environment variables.
- Backup the database before applying new Prisma migrations.
- Monitor `/healthz` for liveness and forward structured logs to your observability stack.

## Troubleshooting

- **`Can't reach database server at 'localhost:5432'`** – ensure Postgres is running locally or update the `DATABASE_URL` host (`db` when using Docker Compose).
- **CORS errors from the browser** – append the frontend origin to `CORS_ORIGINS` (comma separated) and restart the API.
- **429 rate limit responses** – increase `RL_MAX` or extend `RL_WINDOW` during development, or add your IP to `RL_ALLOWLIST`.

For additional questions see the inline comments in `pricing.controller.ts` and `bookings.controller.ts` for curl snippets.
