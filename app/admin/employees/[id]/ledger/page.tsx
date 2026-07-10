'use client'

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getEmployeeLedger } from '@/app/actions';
import Link from 'next/link';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  transactionDate: string;
  balance: number;
  safe: { name: string } | null;
  createdBy: { name: string };
}

interface Employee {
    id: string;
    name: string;
    phone: string | null;
    defaultSalary: number;
}

interface LedgerData {
    employee: Employee;
    transactions: Transaction[];
    summary: {
        totalCredit: number;
        totalDebit: number;
        currentBalance: number;
    };
}

export default function EmployeeLedgerPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = () => {
    if (id) {
      setIsLoading(true);
      getEmployeeLedger(id)
        .then(res => {
          if (res.success && res.data) {
            setLedger(res.data);
          } else {
            setError(res.error || "Failed to fetch ledger data.");
          }
        })
        .catch(err => {
          console.error(err);
          setError("An unexpected error occurred.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }

  useEffect(() => {
    fetchLedger();
  }, [id]);

  if (isLoading) {
    return <div className="p-8 text-center font-bold">جاري تحميل كشف الحساب...</div>;
  }

  if (error) {
    return (
        <div className="p-8 text-center text-red-600 font-bold">
            <p>خطأ: {error}</p>
            <Link href="/admin/employees" className="text-blue-600 hover:underline mt-4 block">العودة إلى قائمة الموظفين</Link>
        </div>
    );
  }

  if (!ledger) {
    return <div className="p-8 text-center">لم يتم العثور على بيانات.</div>;
  }

  const { employee, transactions, summary } = ledger;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto" dir="rtl">
      <div className="mb-6 flex justify-between items-start">
        <div>
            <Link href="/admin/employees" className="text-sm text-blue-600 hover:underline">‹ العودة للموظفين</Link>
            <h1 className="text-3xl font-bold text-gray-800 mt-2">كشف حساب: {employee.name}</h1>
            <p className="text-gray-500">الراتب الافتراضي: {employee.defaultSalary.toFixed(2)} ج.م</p>
        </div>
        <button onClick={fetchLedger} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300 transition-colors">🔄 تحديث</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-green-100 p-4 rounded-xl border border-green-200">
          <h4 className="text-sm font-bold text-green-800">إجمالي المستحقات (داين)</h4>
          <p className="text-2xl font-black text-green-700">{(summary.totalCredit).toFixed(2)}</p>
        </div>
        <div className="bg-red-100 p-4 rounded-xl border border-red-200">
          <h4 className="text-sm font-bold text-red-800">إجمالي المسحوبات (مدين)</h4>
          <p className="text-2xl font-black text-red-600">{Math.abs(summary.totalDebit).toFixed(2)}</p>
        </div>
        <div className={`p-4 rounded-xl border ${summary.currentBalance >= 0 ? 'bg-blue-100 border-blue-200' : 'bg-yellow-100 border-yellow-300'}`}>
          <h4 className={`text-sm font-bold ${summary.currentBalance >= 0 ? 'text-blue-800' : 'text-yellow-800'}`}>
            {summary.currentBalance >= 0 ? 'الرصيد الحالي (له)' : 'الرصيد الحالي (عليه)'}
          </h4>
          <p className={`text-2xl font-black ${summary.currentBalance >= 0 ? 'text-blue-700' : 'text-yellow-700'}`}>{Math.abs(summary.currentBalance).toFixed(2)}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b"><h3 className="font-bold text-lg">سجل الحركات (الأحدث أولاً)</h3></div>
        <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[600px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-sm font-bold text-gray-600">التاريخ</th>
                  <th className="p-3 text-sm font-bold text-gray-600">البيان</th>
                  <th className="p-3 text-sm font-bold text-gray-600 text-center">داين (له)</th>
                  <th className="p-3 text-sm font-bold text-gray-600 text-center">مدين (عليه)</th>
                  <th className="p-3 text-sm font-bold text-gray-600 text-center">الرصيد</th>
                  <th className="p-3 text-sm font-bold text-gray-600">الخزنة</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 text-sm text-gray-500 whitespace-nowrap">{new Date(t.transactionDate).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="p-3 font-semibold">{t.description}</td>
                    <td className="p-3 text-center font-mono font-bold text-green-600">
                      {t.amount > 0 ? t.amount.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-red-600">
                      {t.amount < 0 ? Math.abs(t.amount).toFixed(2) : '-'}
                    </td>
                    <td className={`p-3 text-center font-mono font-bold ${t.balance >= 0 ? 'text-blue-700' : 'text-yellow-700'}`}>
                      {Math.abs(t.balance).toFixed(2)}
                    </td>
                     <td className="p-3 text-sm text-gray-500">{t.safe?.name || '-'}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-gray-500">
                      لا توجد حركات مالية لهذا الموظف حتى الآن.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
