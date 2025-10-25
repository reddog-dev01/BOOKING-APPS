/*
  Warnings:

  - You are about to drop the column `oneWay` on the `Booking` table. All the data in the column will be lost.
  - The primary key for the `SiteSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `key` on the `SiteSetting` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `SiteSetting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[src,sortOrder]` on the table `Banner` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[routeId,vehicleTypeId,effectiveFrom]` on the table `PricePolicy` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `SiteSetting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vatOptions` to the `SiteSetting` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TrunkSize" AS ENUM ('SMALL', 'LARGE');

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "oneWay",
ADD COLUMN     "airportId" TEXT,
ADD COLUMN     "direction" TEXT,
ADD COLUMN     "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fromLat" DOUBLE PRECISION,
ADD COLUMN     "fromLng" DOUBLE PRECISION,
ADD COLUMN     "isRoundTrip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceDistanceVnd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priceWaitingVnd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "toLat" DOUBLE PRECISION,
ADD COLUMN     "toLng" DOUBLE PRECISION,
ADD COLUMN     "waitMinutes" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "routeId" DROP NOT NULL,
ALTER COLUMN "subtotalVnd" SET DEFAULT 0,
ALTER COLUMN "discountVnd" SET DEFAULT 0,
ALTER COLUMN "vatVnd" SET DEFAULT 0,
ALTER COLUMN "totalVnd" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "SiteSetting" DROP CONSTRAINT "SiteSetting_pkey",
DROP COLUMN "key",
DROP COLUMN "value",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "defaultVatPct" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "id" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "mapProvider" TEXT NOT NULL DEFAULT 'google',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vatOptions" JSONB NOT NULL,
ADD COLUMN     "waitRatePerHour" INTEGER NOT NULL DEFAULT 60000,
ADD CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "VehicleType" ADD COLUMN     "perKmVnd" INTEGER NOT NULL DEFAULT 7000,
ADD COLUMN     "trunkSize" "TrunkSize",
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Airport_code_key" ON "Airport"("code");

-- CreateIndex
CREATE INDEX "Airport_isActive_idx" ON "Airport"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Banner_src_sortOrder_key" ON "Banner"("src", "sortOrder");

-- CreateIndex
CREATE INDEX "Booking_airportId_idx" ON "Booking"("airportId");

-- CreateIndex
CREATE UNIQUE INDEX "PricePolicy_routeId_vehicleTypeId_effectiveFrom_key" ON "PricePolicy"("routeId", "vehicleTypeId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_couponCode_fkey" FOREIGN KEY ("couponCode") REFERENCES "Coupon"("code") ON DELETE SET NULL ON UPDATE CASCADE;
