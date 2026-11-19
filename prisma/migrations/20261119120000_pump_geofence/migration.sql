-- The pump's location and the radius (metres) inside which fuel and gift-handover photos may be taken.
-- The location is empty until an admin sets it, so nothing changes until then.

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "geofenceMeters" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "pumpLatitude" DOUBLE PRECISION,
ADD COLUMN     "pumpLongitude" DOUBLE PRECISION;
