-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_customerId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "description" TEXT,
ADD COLUMN     "targetSafeId" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'IN',
ALTER COLUMN "customerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_targetSafeId_fkey" FOREIGN KEY ("targetSafeId") REFERENCES "Safe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
