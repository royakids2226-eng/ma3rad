'use client'
import { useState, useEffect } from 'react';
import { 
    addCustomer, 
    getAdminCustomers, 
    deleteCustomer, 
    addBulkCustomers, 
    deleteBulkCustomers, 
    deleteAllCustomers,
    updateCustomer
} from '@/app/admin-actions';
import * as XLSX from 'xlsx';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form States
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Edit States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  useEffect(() => {
    refreshCustomers();
  }, []);

  const refreshCustomers = () => {
    getAdminCustomers().then(res => {
        setCustomers(res);
        setSelectedIds([]);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return alert('الكود والاسم مطلوبان');

    const res = await addCustomer({ code, name, phone, address });
    if (res.success) {
      alert('تمت إضافة العميل');
      setCode(''); setName(''); setPhone(''); setAddress('');
      refreshCustomers();
    } else {
      alert('خطأ: ' + res.error);
    }
  };

  // --- Excel Logic ---
  const downloadTemplate = () => {
    const templateData = [
        { code: "C101", name: "أحمد محمد", phone: "01012345678", address: "القاهرة - مدينة نصر" },
        { code: "C102", name: "شركة الأمل", phone: "01122334455", address: "الجيزة" }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "Customers_Template.xlsx");
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = async (evt: any) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if(confirm(`تم قراءة ${data.length} عميل. هل تريد حفظهم؟`)) {
            const res = await addBulkCustomers(data);
            if(res.success) {
                alert(`تم استيراد/تحديث ${res.count} عميل بنجاح`);
                refreshCustomers();
            } else {
                alert('حدث خطأ: ' + res.error);
            }
        }
    };
    reader.readAsBinaryString(file);
  };

  // --- Delete Logic ---
  const handleDelete = async (id: string) => {
    if (confirm('حذف هذا العميل؟')) {
      const res = await deleteCustomer(id);
      if(res.success) {
          refreshCustomers();
      } else {
          alert("فشل الحذف: " + res.error);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if(selectedIds.length === 0) return;
    if(confirm(`هل أنت متأكد من حذف ${selectedIds.length} عميل؟`)) {
        await deleteBulkCustomers(selectedIds);
        refreshCustomers();
    }
  };

  const handleDeleteAll = async () => {
    if(confirm("⚠️ تحذير: سيتم حذف جميع العملاء المسجلين! هل أنت متأكد؟")) {
        const res = await deleteAllCustomers();
        if(res.success) {
            alert("تم حذف جميع العملاء");
            refreshCustomers();
        } else {
            alert("خطأ: " + res.error);
        }
    }
  };

  // --- Checkbox Logic ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.checked) setSelectedIds(customers.map(c => c.id));
      else setSelectedIds([]);
  };

  const handleSelectOne = (id: string) => {
      if(selectedIds.includes(id)) setSelectedIds(selectedIds.filter(itemId => itemId !== id));
      else setSelectedIds([...selectedIds, id]);
  };

  // --- Edit Logic ---
  const handleEditClick = (cust: any) => {
      setEditingCustomer({ ...cust });
      setIsEditModalOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
      e.preventDefault();
      const res = await updateCustomer(editingCustomer.id, editingCustomer);
      if(res.success) {
          alert('تم التعديل بنجاح');
          setIsEditModalOpen(false);
          setEditingCustomer(null);
          refreshCustomers();
      } else {
          alert('خطأ: ' + res.error);
      }
  };

  return (
    <div className="space-y-8 relative">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">إدارة العملاء</h1>
        
        <div className="flex gap-2">
            {selectedIds.length > 0 && (
                <button onClick={handleDeleteSelected} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-bold shadow animate-pulse">
                    حذف المحدد ({selectedIds.length})
                </button>
            )}
            <button onClick={handleDeleteAll} className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded text-sm font-bold shadow">
                ⚠️ حذف الجميع
            </button>
        </div>
      </div>

      {/* Excel Section */}
      <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1">
              <h3 className="font-bold text-indigo-800 text-lg mb-1">📥 استيراد عملاء (Excel)</h3>
              <p className="text-sm text-indigo-600 mb-2">الأعمدة المطلوبة: code, name, phone, address</p>
              <button onClick={downloadTemplate} className="bg-white border border-indigo-400 text-indigo-700 px-3 py-1 rounded text-sm hover:bg-indigo-100 transition">
                📄 تحميل نموذج Excel
              </button>
          </div>
          <div className="flex-1 flex flex-col items-end">
             <label className="text-sm font-bold text-gray-700 mb-2">رفع الملف:</label>
             <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="text-sm bg-white p-2 rounded border cursor-pointer w-full md:w-auto" />
          </div>
      </div>

      {/* Form Adding */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4 border-t-4 border-blue-600">
        <h2 className="font-bold text-gray-700 border-b pb-2">إضافة عميل جديد</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">كود العميل</label>
              <input type="text" className="w-full border p-2 rounded bg-gray-50" value={code} onChange={e => setCode(e.target.value)} required />
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">اسم العميل</label>
              <input type="text" className="w-full border p-2 rounded" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">رقم الهاتف</label>
              <input type="text" className="w-full border p-2 rounded" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">العنوان</label>
              <input type="text" className="w-full border p-2 rounded" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold w-full hover:bg-blue-700">حفظ العميل</button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-2 bg-gray-50 border-b text-xs text-gray-500">
            عدد العملاء: {customers.length}
        </div>
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3 w-10 text-center">
                  <input type="checkbox" onChange={handleSelectAll} checked={customers.length > 0 && selectedIds.length === customers.length} />
              </th>
              <th className="p-3">الكود</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">الهاتف</th>
              <th className="p-3">العنوان</th>
              <th className="p-3 text-center">تحكم</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className={`border-b hover:bg-gray-50 ${selectedIds.includes(c.id) ? 'bg-indigo-50' : ''}`}>
                <td className="p-3 text-center">
                    <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleSelectOne(c.id)} />
                </td>
                <td className="p-3 font-bold">{c.code}</td>
                <td className="p-3">{c.name}</td>
                <td className="p-3 text-gray-600">{c.phone}</td>
                <td className="p-3 text-gray-500 text-xs">{c.address}</td>
                <td className="p-3 flex justify-center gap-2">
                  <button onClick={() => handleEditClick(c)} className="text-blue-600 bg-blue-100 px-2 py-1 rounded text-xs font-bold hover:bg-blue-200">تعديل</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-bold hover:bg-red-200">حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">تعديل بيانات العميل</h3>
                  <form onSubmit={handleEditSave} className="space-y-4">
                      <div>
                          <label className="block text-xs text-gray-500 mb-1">كود العميل</label>
                          <input type="text" className="w-full border p-2 rounded bg-gray-100" value={editingCustomer.code} onChange={(e) => setEditingCustomer({...editingCustomer, code: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs text-gray-500 mb-1">الاسم</label>
                          <input type="text" className="w-full border p-2 rounded" value={editingCustomer.name} onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs text-gray-500 mb-1">الهاتف</label>
                          <input type="text" className="w-full border p-2 rounded" value={editingCustomer.phone || ''} onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs text-gray-500 mb-1">العنوان</label>
                          <input type="text" className="w-full border p-2 rounded" value={editingCustomer.address || ''} onChange={(e) => setEditingCustomer({...editingCustomer, address: e.target.value})} />
                      </div>

                      <div className="flex justify-end gap-2 mt-6">
                          <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">إلغاء</button>
                          <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700">حفظ التعديلات</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}