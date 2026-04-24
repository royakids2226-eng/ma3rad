'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

/**
 * Fetches all jobs from the database.
 * PREVENTIVE FIX #4: The schema and database are out of sync. Multiple columns
 * like 'name', 'updatedAt', 'completedAt', and 'progress' do not exist in the database table.
 * This `select` statement is now restricted to only the columns that are known to exist to prevent crashing.
 * ROOT CAUSE: Run `npx prisma db push` to sync your database with your schema.
 */
export async function getJobs() {
    try {
        const jobs = await prisma.job.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                type: true,
                status: true,
                // progress: true,     // REMOVED: Column does not exist in the database
                logs: true,
                payload: true,
                result: true,
            }
        });

        // Manually map to add properties that the client component might expect.
        const jobsWithDefaults = jobs.map(job => ({
            ...job,
            name: job.type, // Using job.type as a fallback for the missing name
            progress: 0,    // Adding a default 'progress' for the client
            completedAt: null // Adding a default 'completedAt' for the client
        }));

        return JSON.parse(JSON.stringify(jobsWithDefaults));
    } catch (error) {
        console.error("Error fetching jobs:", error);
        // In case of an error (like another missing column), return an empty array
        // to prevent the entire page from crashing.
        return [];
    }
}

const SHEET_ID = "1EhPqEOYOzoLREVC3IMsjmXiPP5WXTjhF5_DJxVOcI2M";
const GID = "1008122896";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

export async function syncWarehouseFromSheets(startDateStr: string) {
  try {
    const syncStartDate = new Date(startDateStr);
    if (isNaN(syncStartDate.getTime())) throw new Error("Invalid date selected");

    const response = await fetch(CSV_URL, { next: { revalidate: 0 } });
    if (!response.ok) throw new Error("Failed to connect to Google Sheets");
    const csvText = await response.text();

    const lines = csvText.split("\n").slice(1);
    const newReceiptsData: any[] = [];

    for (const line of lines) {
        const [uniqueid, date, empName, modelNo, most] = line.split(",").map(v => v.trim());
        
        const rowDate = new Date(date);
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

    const syncOp = await prisma.warehouseSyncOperation.create({
        data: { startDate: syncStartDate }
    });

    let createdCount = 0;
    for (const receiptData of newReceiptsData) {
        try {
            const newReceipt = await prisma.warehouseReceipt.create({
                data: receiptData
            });
            createdCount++;

            await prisma.warehouseSyncRecord.create({
                data: {
                    syncOperationId: syncOp.id,
                    warehouseReceiptId: newReceipt.uniqueid
                }
            });

        } catch (e: any) {
            if (e.code !== 'P2002') {
                console.warn(`Failed to add receipt ${receiptData.uniqueid}:`, e.message);
            }
        }
    }

    if (createdCount > 0) {
        await prisma.warehouseSyncOperation.update({
            where: { id: syncOp.id },
            data: { itemsCount: createdCount }
        });
    } else {
        await prisma.warehouseSyncOperation.delete({ where: { id: syncOp.id } });
    }

    revalidatePath('/sorting');
    
    return {
        success: true,
        message: `Successfully synced ${createdCount} new receipts.`
    };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getWarehouseSyncHistory() {
    const ops = await prisma.warehouseSyncOperation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    return JSON.parse(JSON.stringify(ops));
}

export async function revertWarehouseSync(operationId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            const recordsToDelete = await tx.warehouseSyncRecord.findMany({
                where: { syncOperationId: operationId },
                select: { warehouseReceiptId: true }
            });
            const idsToDelete = recordsToDelete.map(r => r.warehouseReceiptId);

            await tx.warehouseSyncRecord.deleteMany({
                where: {
                    syncOperationId: operationId
                }
            });

            if (idsToDelete.length > 0) {
                await tx.warehouseReceipt.deleteMany({
                    where: {
                        uniqueid: {
                            in: idsToDelete
                        }
                    }
                });
            }

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
