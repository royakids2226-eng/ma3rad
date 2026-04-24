
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * API route to CREATE a new background job.
 * This is triggered by the user clicking the "Start Full Sorting" button.
 */
export async function POST() {
    try {
        // Check if there is already a pending or running job to avoid duplicates
        const existingJob = await prisma.job.findFirst({
            where: {
                type: 'FULL_SORTING',
                status: {
                    in: ['PENDING', 'RUNNING']
                }
            }
        });

        if (existingJob) {
            // Return a "Conflict" status to indicate a job is already in the queue
            return NextResponse.json(
                { message: "A sorting job is already pending or running.", jobId: existingJob.id },
                { status: 409 }
            );
        }

        // Create a new job entry in the database with a PENDING status
        const newJob = await prisma.job.create({
            data: {
                name: 'Full Sorting Process',
                type: 'FULL_SORTING',
                status: 'PENDING',
                progress: 0,
                logs: 'Job has been queued and is waiting to be processed.',
            }
        });

        // Return the ID of the newly created job
        return NextResponse.json({ success: true, jobId: newJob.id });

    } catch (error: any) {
        console.error("Failed to create job:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error: Could not create the job." },
            { status: 500 }
        );
    }
}

/**
 * API route for the Vercel Cron Job to EXECUTE pending tasks.
 * This endpoint will be periodically called by Vercel's infrastructure.
 */
export async function GET() {
    // The logic to find and execute the oldest pending job will be implemented here.
    // For now, it confirms that the endpoint is ready.
    console.log("Cron job endpoint was hit.");
    return NextResponse.json({ message: "Job execution endpoint is ready." });
}
