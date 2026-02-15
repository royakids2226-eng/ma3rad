import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ==================================================================
// 1. POST: إضافة سجل جديد (Create)
// ==================================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log("POST Incoming Data:", body);

    const { uniqueid, date, empName, modelNo, most } = body;

    // التحقق من صحة البيانات
    if (!uniqueid || !date || !empName || !modelNo) {
      return NextResponse.json(
        { success: false, error: 'بيانات ناقصة: يجب إرسال جميع الحقول المطلوبة' },
        { status: 400 }
      );
    }

    const parsedMost = parseInt(most);
    if (isNaN(parsedMost)) {
      return NextResponse.json(
        { success: false, error: 'قيمة (most) يجب أن تكون رقماً' },
        { status: 400 }
      );
    }

    // عملية الحفظ
    const newReceipt = await prisma.warehouseReceipt.create({
      data: {
        uniqueid: String(uniqueid),
        date: new Date(date),
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
    }, { status: 201 });

  } catch (error: any) {
    console.error('SERVER ERROR (POST):', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: `السجل مكرر: المعرف ${error.meta?.target} موجود مسبقاً` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'حدث خطأ في السيرفر: ' + (error.message || error) },
      { status: 500 }
    );
  }
}

// ==================================================================
// 2. PUT: تعديل سجل موجود (Update)
// ==================================================================
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    console.log("PUT Incoming Data:", body);

    const { uniqueid, empName, modelNo, most } = body;

    if (!uniqueid) {
      return NextResponse.json(
        { success: false, error: 'يجب توفر uniqueid لتحديث السجل' },
        { status: 400 }
      );
    }

    const parsedMost = parseInt(most);

    // عملية التحديث
    // ملاحظة: نحدث فقط الحقول التي تم إرسالها (empName, modelNo, most)
    const updatedReceipt = await prisma.warehouseReceipt.update({
      where: {
        uniqueid: String(uniqueid), // البحث عن السجل باستخدام uniqueid
      },
      data: {
        empName: String(empName),
        modelNo: String(modelNo),
        most: isNaN(parsedMost) ? undefined : parsedMost, // تحديث الكمية فقط إذا كانت رقماً صالحاً
      },
    });

    console.log("Successfully Updated:", updatedReceipt);

    return NextResponse.json({ 
      success: true, 
      message: "تم التحديث بنجاح", 
      data: updatedReceipt 
    }, { status: 200 });

  } catch (error: any) {
    console.error('SERVER ERROR (PUT):', error);

    // الخطأ P2025 يعني أن السجل غير موجود (Record not found)
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'السجل المراد تحديثه غير موجود' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'فشل التحديث: ' + (error.message || error) },
      { status: 500 }
    );
  }
}

// ==================================================================
// 3. DELETE: حذف سجل (Delete)
// ==================================================================
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    console.log("DELETE Incoming Data:", body);

    const { uniqueid } = body;

    if (!uniqueid) {
      return NextResponse.json(
        { success: false, error: 'يجب توفر uniqueid لحذف السجل' },
        { status: 400 }
      );
    }

    // عملية الحذف
    const deletedReceipt = await prisma.warehouseReceipt.delete({
      where: {
        uniqueid: String(uniqueid),
      },
    });

    console.log("Successfully Deleted:", deletedReceipt);

    return NextResponse.json({ 
      success: true, 
      message: "تم الحذف بنجاح", 
      data: deletedReceipt 
    }, { status: 200 });

  } catch (error: any) {
    console.error('SERVER ERROR (DELETE):', error);

    // الخطأ P2025 يعني أن السجل غير موجود
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'السجل المراد حذفه غير موجود بالفعل' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'فشل الحذف: ' + (error.message || error) },
      { status: 500 }
    );
  }
}