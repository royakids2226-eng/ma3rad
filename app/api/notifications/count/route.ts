// app/api/notifications/count/route.ts
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// إجبار نكست على عدم حفظ هذه الدالة (No Cache)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const count = await prisma.product.count({
      where: {
        currentStock: { lte: 4 },
        status: "OPEN",
      },
    });
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}