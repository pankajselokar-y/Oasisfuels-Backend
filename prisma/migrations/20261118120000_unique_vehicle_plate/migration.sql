-- A vehicle plate can belong to only one customer. Fails (and changes nothing) if two customers already share a plate.

-- DropIndex
DROP INDEX "Vehicle_customerId_numberKey_key";

-- DropIndex
DROP INDEX "Vehicle_numberKey_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_numberKey_key" ON "Vehicle"("numberKey");

-- CreateIndex
CREATE INDEX "Vehicle_customerId_idx" ON "Vehicle"("customerId");
