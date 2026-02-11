import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// منع الكاش نهائياً في نكست
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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