'use server'

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// --- Constants for Google Sheet ---
const SHEET_ID = "1EhPqEOYOzoLREVC3IMsjmXiPP5WXTjhF5_DJxVOcI2M";
const GID = "1008122896";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// --- Main Handler for the API Route ---
// This function will be triggered by a GET request to /api/jobs/execute
export async function GET() {
    // 1. Find the oldest pending job
    const job = await prisma.job.findFirst({
        where: { type: 'SYNC_WAREHOUSE_FROM_SHEETS', status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
    });

    if (!job) {
        return NextResponse.json({ message: "No pending jobs found." });
    }

    // 2. Mark the job as RUNNING to prevent duplicate execution
    await prisma.job.update({
        where: { id: job.id },
        data: { status: 'RUNNING' },
    });

    let executionResult;
    try {
        // 3. Execute the actual sync logic
        executionResult = await executeWarehouseSync(job.payload as any);

        // 4. Mark the job as COMPLETED
        await prisma.job.update({
            where: { id: job.id },
            data: { status: 'COMPLETED', result: executionResult as any },
        });

        return NextResponse.json({ success: true, message: "Job completed successfully", details: executionResult });

    } catch (error: any) {
        console.error("Job execution failed:", error);
        // 5. Mark the job as FAILED
        await prisma.job.update({
            where: { id: job.id },
            data: { status: 'FAILED', result: { error: error.message } as any },
        });
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// --- The actual sync logic, adapted to run as a job ---
async function executeWarehouseSync(payload: { startDate: string }) {
    const { startDate } = payload;
    const syncStartDate = new Date(startDate);

    const response = await fetch(CSV_URL, { next: { revalidate: 0 } });
    if (!response.ok) throw new Error("Failed to connect to Google Sheets");
    const csvText = await response.text();

    const lines = csvText.split('\n').slice(1);
    const newReceiptsData: any[] = [];

    for (const line of lines) {
        const [uniqueid, date, empName, modelNo, most] = line.split(",").map(v => v.trim());
        const rowDate = new Date(date);
        if (!uniqueid || !date || rowDate < syncStartDate) continue;

        newReceiptsData.push({
            uniqueid,
            date: rowDate,
            empName,
            modelNo,
            most: parseInt(most) || 0,
        });
    }

    if (newReceiptsData.length === 0) {
        return { message: "No new receipts to sync." };
    }

    // Using a transaction to ensure all or nothing is written to the DB
    return await prisma.$transaction(async (tx) => {
        const syncOp = await tx.warehouseSyncOperation.create({
            data: { startDate: syncStartDate }
        });

        let createdCount = 0;
        for (const receiptData of newReceiptsData) {
            try {
                const newReceipt = await tx.warehouseReceipt.create({ data: receiptData });
                createdCount++;
                await tx.warehouseSyncRecord.create({
                    data: {
                        syncOperationId: syncOp.id,
                        warehouseReceiptId: newReceipt.uniqueid
                    }
                });
            } catch (e: any) {
                if (e.code !== 'P2002') {
                    console.warn(`Skipping duplicate receipt ${receiptData.uniqueid}:`, e.message);
                }
            }
        }

        if (createdCount > 0) {
            await tx.warehouseSyncOperation.update({
                where: { id: syncOp.id },
                data: { itemsCount: createdCount }
            });
        } else {
            await tx.warehouseSyncOperation.delete({ where: { id: syncOp.id } });
        }

        return { createdCount };
    });
}

// To make this a dynamic route that Vercel will not cache
export const dynamic = 'force-dynamic';
