-- AlterTable
ALTER TABLE "FuelClaim" ADD COLUMN     "photoData" BYTEA,
ALTER COLUMN "photoPath" DROP NOT NULL;
