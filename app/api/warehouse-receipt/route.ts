import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // تأكد من استيراد النسخة التي أنشأناها في الخطوة السابقة

// دالة POST لاستقبال البيانات
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // طباعة البيانات القادمة في Logs الخاصة بـ Vercel للتأكد من وصولها
    console.log("Incoming Data Payload:", body);

    const { uniqueid, date, empName, modelNo, most } = body;

    // 1. التحقق من صحة البيانات (Validation)
    if (!uniqueid || !date || !empName || !modelNo) {
      return NextResponse.json(
        { success: false, error: 'بيانات ناقصة: يجب إرسال جميع الحقول المطلوبة' },
        { status: 400 }
      );
    }

    // التأكد أن "القص" رقم صحيح
    const parsedMost = parseInt(most);
    if (isNaN(parsedMost)) {
      return NextResponse.json(
        { success: false, error: 'قيمة (most) يجب أن تكون رقماً' },
        { status: 400 }
      );
    }

    // 2. عملية الحفظ في قاعدة البيانات
    const newReceipt = await prisma.warehouseReceipt.create({
      data: {
        uniqueid: String(uniqueid),
        date: new Date(date), // التأكد من تحويل النص إلى تاريخ
        empName: String(empName),
        modelNo: String(modelNo),
        most: parsedMost
      }
    });

    console.log("Successfully Saved:", newReceipt);

    return NextResponse.json({ 
      success: true, 
      message: "تم الحفظ بنجاح", 
      data: newReceipt 
    }, { status: 200 });

  } catch (error: any) {
    console.error('SERVER ERROR - Warehouse Receipt:', error);
    
    // التعامل مع خطأ التكرار (Unique Constraint)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: `السجل مكرر: المعرف ${error.meta?.target} موجود مسبقاً` },
        { status: 409 }
      );
    }

    // أخطاء الاتصال أو غيرها
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في السيرفر: ' + (error.message || error) },
      { status: 500 }
    );
  }
}