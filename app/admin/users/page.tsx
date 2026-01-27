'use client'
import { useState, useEffect } from 'react';
import { addUser, getUsers, deleteUser } from '@/app/admin-actions';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({ code: '', name: '', password: '', role: 'EMPLOYEE' });

  useEffect(() => {
    getUsers().then(setUsers);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.password) return alert('البيانات ناقصة');
    
    const res = await addUser(formData);
    if (res.success) {
      alert('تمت الإضافة');
      setFormData({ code: '', name: '', password: '', role: 'EMPLOYEE' });
      getUsers().then(setUsers);
    } else {
      alert('خطأ: ' + res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('حذف المستخدم؟')) {
      await deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">إدارة الموظفين والصلاحيات</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">كود الدخول</label>
            <input type="text" className="w-full border p-2 rounded" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">الاسم</label>
            <input type="text" className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">كلمة السر</label>
            <input type="text" className="w-full border p-2 rounded" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">الصلاحية</label>
            <select className="w-full border p-2 rounded" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
              <option value="EMPLOYEE">موظف (بيع فقط)</option>
              <option value="ACCOUNTANT">محاسب</option>
              <option value="ADMIN">مدير نظام</option>
              <option value="OWNER">صاحب شركة</option>
            </select>
          </div>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold w-full hover:bg-blue-700">إضافة مستخدم</button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3">الكود</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">الصلاحية</th>
              <th className="p-3">تحكم</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b">
                <td className="p-3 font-bold">{u.code}</td>
                <td className="p-3">{u.name}</td>
                <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold 
                        ${u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 
                          u.role === 'ACCOUNTANT' ? 'bg-purple-100 text-purple-700' : 
                          'bg-green-100 text-green-700'}`}>
                        {u.role}
                    </span>
                </td>
                <td className="p-3">
                  <button onClick={() => handleDelete(u.id)} className="text-red-600 font-bold hover:underline">حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}