import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
      // جلب الأصناف الـ CLOSED التي رصيدها 4 أو أقل
          const lowStockItems = await prisma.product.findMany({
                where: {
                        status: "CLOSED",
                                currentStock: { lte: 4 },
                                      },
                                            select: {
                                                    id: true 
                                                          }
                                                              });

                                                                  return NextResponse.json({ 
                                                                        count: lowStockItems.length,
                                                                              ids: lowStockItems.map(item => item.id) 
                                                                                  });
                                                                                    } catch (error) {
                                                                                        return NextResponse.json({ count: 0, ids: [] }, { status: 500 });
                                                                                          }
                                                                                          }