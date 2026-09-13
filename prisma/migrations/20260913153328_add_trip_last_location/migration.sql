-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "lastKnownLat" DOUBLE PRECISION,
ADD COLUMN     "lastKnownLng" DOUBLE PRECISION,
ADD COLUMN     "lastLocationUpdatedAt" TIMESTAMP(3);
