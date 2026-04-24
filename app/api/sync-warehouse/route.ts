import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSj1esI93ewyLBbvhdK7PKys8Ex5nfnUDaCU9y3cFXpok6Ist_t2RfGiJ1NRi-PfYhqB4-o6yO8FY1r/pub?gid=1008122896&single=true&output=csv';

export async function POST(request: NextRequest) {
  try {
    const { startDate } = await request.json();
    if (!startDate) {
      return NextResponse.json({ error: 'يرجى إدخال تاريخ البدء' }, { status: 400 });
    }

    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);

    // جلب البيانات من Google Sheets
    const response = await fetch(`${CSV_URL}&_=${Date.now()}`, {
      next: { revalidate: 0 } // لمنع الكاش في بيئة Next.js
    });
    
    if (!response.ok) {
      throw new Error(`فشل جلب البيانات: ${response.status}`);
    }
    
    const csvText = await response.text();
    
    // تحليل CSV البسيط
    const rows = csvText.split('\n').map(row => {
      const matches = row.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
      return matches ? matches.map(m => m.replace(/^"|"$/g, '').trim()) : [];
    });

    if (rows.length < 2) {
      return NextResponse.json({ error: 'لا توجد بيانات في الجدول' }, { status: 400 });
    }

    const dataRows = rows.slice(1);
    let inserted = 0;
    let skipped = 0;

    for (const row of dataRows) {
      if (row.length < 5) continue;
      
      const [uniqueid, dateStr, empName, modelNo, mostStr] = row;
      
      if (!uniqueid || !modelNo) continue;
      
      const itemDate = new Date(dateStr);
      if (isNaN(itemDate.getTime())) continue;
      if (itemDate < startDateObj) continue;
      
      // ✅ التحقق من وجود السجل مسبقاً
      const existing = await prisma.warehouseReceipt.findUnique({
        where: { uniqueid }
      });
      
      if (existing) {
        skipped++;
        continue; // تخطي الموجود
      }
      
      // ✅ إدراج السجل الجديد
      await prisma.warehouseReceipt.create({
        data: {
          uniqueid,
          date: itemDate,
          empName: empName || '',
          modelNo,
          most: parseInt(mostStr) || 0
        }
      });
      inserted++;
    }
    
    return NextResponse.json({
      success: true,
      message: `✅ تم إدراج ${inserted} سجل جديد. تم تخطي ${skipped} سجل مكرر.`,
      stats: { inserted, skipped }
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: `فشلت المزامنة: ${error.message}` },
      { status: 500 }
    );
  }
}