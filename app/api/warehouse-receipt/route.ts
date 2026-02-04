import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// دالة POST لاستقبال البيانات وإضافتها للجدول
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uniqueid, date, empName, modelNo, most } = body;

    // التحقق من البيانات المطلوبة
    if (!uniqueid || !date || !empName || !modelNo || most === undefined) {
      return NextResponse.json(
        { success: false, error: 'بيانات غير مكتملة' },
        { status: 400 }
      );
    }

    // إضافة البيانات لقاعدة البيانات
    const newReceipt = await prisma.warehouseReceipt.create({
      data: {
        uniqueid: String(uniqueid),
        date: new Date(date), // تحويل النص إلى تاريخ
        empName: String(empName),
        modelNo: String(modelNo),
        most: parseInt(most)
      }
    });

    return NextResponse.json({ success: true, data: newReceipt });

  } catch (error: any) {
    console.error('Error adding warehouse receipt:', error);
    
    // التحقق من خطأ التكرار (Unique Constraint)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'رقم العملية (uniqueid) مسجل مسبقاً' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء الحفظ في قاعدة البيانات' },
      { status: 500 }
    );
  }
}