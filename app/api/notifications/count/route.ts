import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // جلب الأصناف الـ CLOSED التي رصيدها 4 أو أقل + ولم يتم قراءتها
    const unreadLowStockItems = await prisma.product.findMany({
      where: {
        status: "CLOSED",
        currentStock: { lte: 4 },
        isStockAlertRead: false, // 👈 نحسب فقط اللي لسه محدش داس عليه
      },
      select: {
        id: true 
      }
    });

    return NextResponse.json({ 
      count: unreadLowStockItems.length,
      ids: unreadLowStockItems.map(item => item.id) 
    });
  } catch (error) {
    return NextResponse.json({ count: 0, ids: [] }, { status: 500 });
  }
}