-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "roundTripWaitMinutes" INTEGER NOT NULL DEFAULT 90,
ALTER COLUMN "waitRatePerHour" SET DEFAULT 30000;
