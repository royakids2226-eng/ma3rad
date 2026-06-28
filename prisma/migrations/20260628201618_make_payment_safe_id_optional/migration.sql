-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_safeId_fkey";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "safeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_safeId_fkey" FOREIGN KEY ("safeId") REFERENCES "Safe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
