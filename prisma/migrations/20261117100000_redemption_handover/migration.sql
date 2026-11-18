-- AlterEnum
ALTER TYPE "TransactionSource" ADD VALUE 'REDEMPTION_REFUND';

-- AlterTable
ALTER TABLE "RedemptionRequest" ADD COLUMN     "cancelledByCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "handoverAccuracy" DOUBLE PRECISION,
ADD COLUMN     "handoverLatitude" DOUBLE PRECISION,
ADD COLUMN     "handoverLongitude" DOUBLE PRECISION,
ADD COLUMN     "handoverPhoto" BYTEA,
ADD COLUMN     "handoverPhotoMime" TEXT,
ADD COLUMN     "pointsDeductedAt" TIMESTAMP(3),
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT;
