-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EGP';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EGP';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "currentStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
