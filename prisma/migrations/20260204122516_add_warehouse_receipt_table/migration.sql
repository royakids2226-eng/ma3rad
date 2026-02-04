-- CreateTable
CREATE TABLE "WarehouseReceipt" (
    "uniqueid" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "empName" TEXT NOT NULL,
    "modelNo" TEXT NOT NULL,
    "most" INTEGER NOT NULL,

    CONSTRAINT "WarehouseReceipt_pkey" PRIMARY KEY ("uniqueid")
);

-- CreateIndex
CREATE INDEX "WarehouseReceipt_modelNo_idx" ON "WarehouseReceipt"("modelNo");

-- CreateIndex
CREATE INDEX "WarehouseReceipt_date_idx" ON "WarehouseReceipt"("date");
