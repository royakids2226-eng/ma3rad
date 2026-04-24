'use server'

import { prisma } from '@/lib/prisma' // <-- Correct: Use the shared prisma instance
import { revalidatePath } from 'next/cache'

const SHEET_ID = "1EhPqEOYOzoLREVC3IMsjmXiPP5WXTjhF5_DJxVOcI2M";
const GID = "1008122896"; // <-- GID for the warehouse sheet
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

/**
 * Fetches data from the warehouse Google Sheet,
 * adds it to the database, and logs the operation for rollback.
 */
export async function syncWarehouseFromSheets(startDateStr: string) {
  try {
    const syncStartDate = new Date(startDateStr);
    if (isNaN(syncStartDate.getTime())) throw new Error("Invalid date selected");

    const response = await fetch(CSV_URL, { next: { revalidate: 0 } }); // Disable cache
    if (!response.ok) throw new Error("Failed to connect to Google Sheets");
    const csvText = await response.text();

    const lines = csvText.split("\n").slice(1); // Ignore header
    const newReceiptsData: any[] = [];

    for (const line of lines) {
        const [uniqueid, date, empName, modelNo, most] = line.split(",").map(v => v.trim());
        
        const rowDate = new Date(date);
        // Validate date and essential data
        if (!uniqueid || !date || rowDate < syncStartDate) {
            continue;
        }

        newReceiptsData.push({
            uniqueid,
            date: rowDate,
            empName,
            modelNo,
            most: parseInt(most) || 0,
        });
    }

    if (newReceiptsData.length === 0) {
      return { success: true, message: "No new receipts found since the selected date." };
    }

    // 1. Create a log for the sync operation
    const syncOp = await prisma.warehouseSyncOperation.create({
        data: { startDate: syncStartDate }
    });

    let createdCount = 0;
    for (const receiptData of newReceiptsData) {
        try {
            // 2. Add the new warehouse receipt
            const newReceipt = await prisma.warehouseReceipt.create({
                data: receiptData
            });
            createdCount++;

            // 3. Link the new receipt to the sync operation for future rollback
            await prisma.warehouseSyncRecord.create({
                data: {
                    syncOperationId: syncOp.id,
                    warehouseReceiptId: newReceipt.uniqueid
                }
            });

        } catch (e: any) {
            // Ignore duplicate errors (unique constraint) if the record already exists
            if (e.code !== 'P2002') {
                console.warn(`Failed to add receipt ${receiptData.uniqueid}:`, e.message);
            }
        }
    }

    // 4. Update the sync operation with the actual number of added receipts
    if (createdCount > 0) {
        await prisma.warehouseSyncOperation.update({
            where: { id: syncOp.id },
            data: { itemsCount: createdCount }
        });
    } else {
        // If no receipts were added (e.g., all were duplicates), delete the empty log
        await prisma.warehouseSyncOperation.delete({ where: { id: syncOp.id } });
    }

    revalidatePath('/sorting'); // Revalidate the sorting page
    
    return {
        success: true,
        message: `Successfully synced ${createdCount} new receipts.`
    };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetches the sync history for the warehouse.
 */
export async function getWarehouseSyncHistory() {
    const ops = await prisma.warehouseSyncOperation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10 // Show the last 10 operations only
    });
    return JSON.parse(JSON.stringify(ops));
}

/**
 * Reverts a specific sync operation by deleting all its associated receipts.
 * This is done in a transaction to ensure data integrity.
 */
export async function revertWarehouseSync(operationId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Find all sync records for the operation to get the receipt IDs
            const recordsToDelete = await tx.warehouseSyncRecord.findMany({
                where: { syncOperationId: operationId },
                select: { warehouseReceiptId: true }
            });
            const idsToDelete = recordsToDelete.map(r => r.warehouseReceiptId);

            // 2. Delete the sync records themselves. This breaks the foreign key link.
            await tx.warehouseSyncRecord.deleteMany({
                where: {
                    syncOperationId: operationId
                }
            });

            // 3. Delete the warehouse receipts that were created by this sync
            if (idsToDelete.length > 0) {
                await tx.warehouseReceipt.deleteMany({
                    where: {
                        uniqueid: {
                            in: idsToDelete
                        }
                    }
                });
            }

            // 4. Delete the (now empty of records) sync operation log itself
            await tx.warehouseSyncOperation.delete({
                where: { id: operationId }
            });
        });

        revalidatePath('/sorting');
        return { success: true };
    } catch (e: any) {
        console.error("Revert failed:", e);
        return { success: false, error: 'An error occurred while reverting the sync.' };
    }
}
