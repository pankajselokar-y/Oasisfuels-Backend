-- The fuel rate can have paise (99.38). Existing whole-number rates convert unchanged.

-- AlterTable
ALTER TABLE "Setting" ALTER COLUMN "fuelRatePerLitre" SET DATA TYPE DOUBLE PRECISION;
