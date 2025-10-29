-- Add Quote model and link bookings to quotes
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "tripType" "TripType" NOT NULL,
    "routeId" TEXT,
    "airportId" TEXT,
    "vehicleTypeId" INTEGER NOT NULL,
    "basePriceVnd" INTEGER NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeMinutes" INTEGER NOT NULL DEFAULT 0,
    "vatPct" INTEGER NOT NULL DEFAULT 0,
    "vatAmountVnd" INTEGER NOT NULL DEFAULT 0,
    "totalVnd" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Quote_vehicleTypeId_idx" ON "Quote"("vehicleTypeId");
CREATE INDEX "Quote_expiresAt_idx" ON "Quote"("expiresAt");
CREATE INDEX "Quote_routeId_idx" ON "Quote"("routeId");
CREATE INDEX "Quote_airportId_idx" ON "Quote"("airportId");

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_vehicleTypeId_fkey"
  FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_airportId_fkey"
  FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD COLUMN "customerNote" TEXT,
  ADD COLUMN "quoteId" TEXT;

CREATE INDEX "Booking_quoteId_idx" ON "Booking"("quoteId");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
