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
  const [phone2, setPhone2] = useState(''); // 👈 جديد
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

    const res = await addCustomer({ code, name, phone, phone2, address }); // 👈
    if (res.success) {
      alert('تمت إضافة العميل');
      setCode(''); setName(''); setPhone(''); setPhone2(''); setAddress('');
      refreshCustomers();
    } else {
      alert('خطأ: ' + res.error);
    }
  };

  // --- Excel Logic ---
  const downloadTemplate = () => {
    const templateData = [
        { code: "C101", name: "عميل 1", phone: "010xxxx", phone2: "011xxxx", address: "العنوان" },
        { code: "C102", name: "عميل 2", phone: "012xxxx", phone2: "", address: "العنوان" }
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
                alert(`تم بنجاح`);
                refreshCustomers();
            } else {
                alert('خطأ: ' + res.error);
            }
        }
    };
    reader.readAsBinaryString(file);
  };

  // --- Delete Logic ---
  const handleDelete = async (id: string) => {
    if (confirm('حذف هذا العميل؟')) {
      await deleteCustomer(id);
      refreshCustomers();
    }
  };

  const handleDeleteSelected = async () => {
    if(selectedIds.length === 0) return;
    if(confirm(`حذف ${selectedIds.length} عميل؟`)) {
        await deleteBulkCustomers(selectedIds);
        refreshCustomers();
    }
  };

  const handleDeleteAll = async () => {
    if(confirm("⚠️ سيتم حذف جميع العملاء! هل أنت متأكد؟")) {
        await deleteAllCustomers();
        refreshCustomers();
    }
  };

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
          alert('تم التعديل');
          setIsEditModalOpen(false);
          setEditingCustomer(null);
          refreshCustomers();
      } else {
          alert('خطأ');
      }
  };

  return (
    <div className="space-y-8 relative">
       <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold">إدارة العملاء</h1>
        <div className="flex gap-2">
            {selectedIds.length > 0 && (
                <button onClick={handleDeleteSelected} className="bg-red-500 text-white px-4 py-2 rounded text-sm font-bold animate-pulse">
                    حذف المحدد ({selectedIds.length})
                </button>
            )}
            <button onClick={handleDeleteAll} className="bg-red-800 text-white px-4 py-2 rounded text-sm font-bold">
                ⚠️ حذف الجميع
            </button>
        </div>
      </div>

      <div className="bg-indigo-50 p-4 rounded border border-indigo-200 flex justify-between items-center">
          <div>
              <h3 className="font-bold text-indigo-800">📥 استيراد Excel</h3>
              <button onClick={downloadTemplate} className="text-xs text-indigo-600 underline">تحميل النموذج (phone2 added)</button>
          </div>
          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="text-sm" />
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4 border-t-4 border-blue-600">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div><label className="text-xs font-bold text-gray-500">الكود</label><input type="text" className="w-full border p-2 rounded" value={code} onChange={e => setCode(e.target.value)} required /></div>
          <div><label className="text-xs font-bold text-gray-500">الاسم</label><input type="text" className="w-full border p-2 rounded" value={name} onChange={e => setName(e.target.value)} required /></div>
          <div><label className="text-xs font-bold text-gray-500">هاتف 1</label><input type="text" className="w-full border p-2 rounded" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label className="text-xs font-bold text-gray-500">هاتف 2</label><input type="text" className="w-full border p-2 rounded bg-yellow-50" value={phone2} onChange={e => setPhone2(e.target.value)} /></div>
          <div><label className="text-xs font-bold text-gray-500">العنوان</label><input type="text" className="w-full border p-2 rounded" value={address} onChange={e => setAddress(e.target.value)} /></div>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold w-full">حفظ العميل</button>
      </form>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 w-10"><input type="checkbox" onChange={handleSelectAll} checked={customers.length > 0 && selectedIds.length === customers.length} /></th>
              <th className="p-3">الكود</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">هاتف 1</th>
              <th className="p-3">هاتف 2</th>
              <th className="p-3">العنوان</th>
              <th className="p-3 text-center">تحكم</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className={`border-b hover:bg-gray-50 ${selectedIds.includes(c.id) ? 'bg-indigo-50' : ''}`}>
                <td className="p-3"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleSelectOne(c.id)} /></td>
                <td className="p-3 font-bold">{c.code}</td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3 text-gray-600">{c.phone2}</td>
                <td className="p-3 text-xs">{c.address}</td>
                <td className="p-3 flex justify-center gap-2">
                  <button onClick={() => handleEditClick(c)} className="text-blue-600 bg-blue-100 px-2 py-1 rounded">تعديل</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 bg-red-100 px-2 py-1 rounded">حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditModalOpen && editingCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded w-full max-w-lg p-6 space-y-4">
                  <h3 className="font-bold border-b pb-2">تعديل بيانات العميل</h3>
                  <input type="text" placeholder="الكود" className="w-full border p-2" value={editingCustomer.code} onChange={(e) => setEditingCustomer({...editingCustomer, code: e.target.value})} />
                  <input type="text" placeholder="الاسم" className="w-full border p-2" value={editingCustomer.name} onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})} />
                  <input type="text" placeholder="هاتف 1" className="w-full border p-2" value={editingCustomer.phone || ''} onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})} />
                  <input type="text" placeholder="هاتف 2" className="w-full border p-2 bg-yellow-50" value={editingCustomer.phone2 || ''} onChange={(e) => setEditingCustomer({...editingCustomer, phone2: e.target.value})} />
                  <input type="text" placeholder="العنوان" className="w-full border p-2" value={editingCustomer.address || ''} onChange={(e) => setEditingCustomer({...editingCustomer, address: e.target.value})} />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                      <button onClick={handleEditSave} className="px-4 py-2 text-white bg-blue-600 rounded">حفظ</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}