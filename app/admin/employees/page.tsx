'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getEmployees, addEmployee, updateEmployee, createSalaryCredit } from '@/app/actions';
import { useSession } from 'next-auth/react';

interface Employee {
  id: string;
  name: string;
  phone: string | null;
  defaultSalary: number;
  _count: {
    transactions: number;
  };
}

export default function ManageEmployeesPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  const [employeeForm, setEmployeeForm] = useState({
    id: '',
    name: '',
    phone: '',
    defaultSalary: '0',
  });

  const [salaryForm, setSalaryForm] = useState({
      employeeId: '',
      amount: '',
      description: '',
      transactionDate: new Date().toISOString().split('T')[0],
  });

  const fetchEmployees = async () => {
    setIsLoading(true);
    const res = await getEmployees();
    if (res.success && res.data) {
      setEmployees(res.data);
    } else {
      alert('Failed to fetch employees: ' + res.error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openAddModal = () => {
    setEmployeeForm({ id: '', name: '', phone: '', defaultSalary: '0' });
    setIsModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setEmployeeForm({
      id: employee.id,
      name: employee.name,
      phone: employee.phone || '',
      defaultSalary: employee.defaultSalary.toString(),
    });
    setIsModalOpen(true);
  };
  
  const openSalaryModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSalaryForm({
      employeeId: employee.id,
      amount: employee.defaultSalary > 0 ? employee.defaultSalary.toString() : '',
      description: `إضافة راتب مستحق لشهر ${new Date().toLocaleString('ar', { month: 'long' })}`,
      transactionDate: new Date().toISOString().split('T')[0],
    });
    setIsSalaryModalOpen(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmployeeForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSalaryFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSalaryForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const dataToSave = {
      name: employeeForm.name,
      phone: employeeForm.phone || undefined,
      defaultSalary: parseFloat(employeeForm.defaultSalary) || 0,
    };

    let res;
    if (employeeForm.id) {
      res = await updateEmployee(employeeForm.id, dataToSave);
    } else {
      res = await addEmployee(dataToSave);
    }

    if (res.success) {
      alert(`تم ${employeeForm.id ? 'تحديث' : 'إضافة'} الموظف بنجاح!`);
      setIsModalOpen(false);
      fetchEmployees(); // Refresh the list
    } else {
      alert('فشل الحفظ: ' + res.error);
    }
    setIsSaving(false);
  };
  
  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.image) {
        alert("خطأ: لم يتم التعرف على المستخدم الحالي.");
        return;
    }
    setIsSaving(true);

    const data = {
        employeeId: salaryForm.employeeId,
        amount: parseFloat(salaryForm.amount),
        description: salaryForm.description,
        transactionDate: new Date(salaryForm.transactionDate),
    };

    const res = await createSalaryCredit(data, session.user.image);

    if (res.success) {
        alert("تم تسجيل الراتب المستحق بنجاح!");
        setIsSalaryModalOpen(false);
        fetchEmployees();
    } else {
        alert("فشل تسجيل الراتب: " + res.error);
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-lg font-bold">جاري تحميل بيانات الموظفين...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">إدارة الموظفين</h1>
        <button
          onClick={openAddModal}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-blue-700 transition-colors"
        >
          + إضافة موظف جديد
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-sm font-bold text-gray-600">الاسم</th>
              <th className="p-4 text-sm font-bold text-gray-600">الهاتف</th>
              <th className="p-4 text-sm font-bold text-gray-600">الراتب الافتراضي</th>
              <th className="p-4 text-sm font-bold text-gray-600 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                <td className="p-4 font-semibold">{emp.name}</td>
                <td className="p-4 text-gray-600">{emp.phone || '-'}</td>
                <td className="p-4 text-gray-600">{emp.defaultSalary.toFixed(2)} ج.م</td>
                <td className="p-4 text-center space-x-2 space-x-reverse">
                  <button onClick={() => openSalaryModal(emp)} className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-md hover:bg-green-200">
                    إضافة راتب
                  </button>
                  <button onClick={() => openEditModal(emp)} className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1.5 rounded-md hover:bg-yellow-200">
                    تعديل
                  </button>
                  <Link href={`/admin/employees/${emp.id}/ledger`} className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-md hover:bg-blue-200">
                    كشف حساب
                  </Link>
                </td>
              </tr>
            ))}
             {employees.length === 0 && (
                <tr>
                    <td colSpan={4} className="text-center p-8 text-gray-500">
                        لم يتم إضافة أي موظفين بعد.
                    </td>
                </tr>
             )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-lg mb-4 text-center">{employeeForm.id ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h3>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">اسم الموظف</label>
                <input type="text" name="name" value={employeeForm.name} onChange={handleFormChange} className="w-full border p-3 rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">رقم الهاتف</label>
                <input type="text" name="phone" value={employeeForm.phone} onChange={handleFormChange} className="w-full border p-3 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">الراتب المستحق الافتراضي</label>
                <input type="number" name="defaultSalary" value={employeeForm.defaultSalary} onChange={handleFormChange} className="w-full border p-3 rounded-lg" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-200 py-3 rounded-lg font-bold hover:bg-gray-300">إلغاء</button>
                <button type="submit" disabled={isSaving} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow hover:bg-blue-700 disabled:bg-gray-400">
                  {isSaving ? '⏳ جاري الحفظ...' : 'حفظ ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {isSalaryModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-lg mb-4 text-center">إضافة راتب مستحق لـ <span className="text-blue-700">{selectedEmployee.name}</span></h3>
            <form onSubmit={handleSaveSalary} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">المبلغ (دائن)</label>
                <input type="number" name="amount" value={salaryForm.amount} onChange={handleSalaryFormChange} className="w-full border p-3 rounded-lg bg-green-50" required />
              </div>
               <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">التاريخ</label>
                <input type="date" name="transactionDate" value={salaryForm.transactionDate} onChange={handleSalaryFormChange} className="w-full border p-3 rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">الوصف</label>
                <textarea name="description" value={salaryForm.description} onChange={e => handleSalaryFormChange(e)} className="w-full border p-3 rounded-lg" rows={2} required></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsSalaryModalOpen(false)} className="flex-1 bg-gray-200 py-3 rounded-lg font-bold hover:bg-gray-300">إلغاء</button>
                <button type="submit" disabled={isSaving} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold shadow hover:bg-green-700 disabled:bg-gray-400">
                  {isSaving ? '⏳ جاري الحفظ...' : 'حفظ الراتب ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
