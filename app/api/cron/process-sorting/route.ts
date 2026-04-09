import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeSortingJob } from '@/app/sorting/actions';

/**
 * This API route is the background worker.
 * It is triggered to process long-running jobs from the 'Job' table.
 * To ensure security, it should only be accessible by trusted services (e.g., a cron job provider).
 */
export async function POST(req: Request) {
  try {
    // Security check: Ensure the request comes from a trusted source.
    // In a production environment, you would use a secret key or a specific header.
    const secret = req.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      console.warn('Unauthorized attempt to trigger cron job');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all pending sorting jobs in the database.
    const pendingJobs = await prisma.job.findMany({
      where: {
        type: 'PROCESS_SORTING_BATCH',
        status: 'PENDING',
      },
    });

    if (pendingJobs.length === 0) {
      return NextResponse.json({ message: 'No pending jobs to process' });
    }

    // Process each job sequentially.
    for (const job of pendingJobs) {
      // Mark the job as 'IN_PROGRESS' to prevent other workers from picking it up.
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'IN_PROGRESS' },
      });

      // Execute the core logic of the job.
      await executeSortingJob(job);
    }

    return NextResponse.json({ success: true, processed: pendingJobs.length });

  } catch (error) {
    console.error('Error in cron job handler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
