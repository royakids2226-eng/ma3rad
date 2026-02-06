-- CreateTable
CREATE TABLE "FulfillmentLog" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfillmentLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FulfillmentLog" ADD CONSTRAINT "FulfillmentLog_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
