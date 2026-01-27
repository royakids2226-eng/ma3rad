'use client'
import { useState, useEffect } from 'react';
import { 
    addProduct, 
    getProducts, 
    deleteProduct, 
    addBulkProducts, 
    deleteBulkProducts, 
    deleteAllProducts,
    updateProduct 
} from '@/app/admin-actions';
import * as XLSX from 'xlsx';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // States for Adding New Product
  const [modelNo, setModelNo] = useState('');
  const [description, setDescription] = useState('');
  const [material, setMaterial] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [colors, setColors] = useState([{ color: '', stock: '' }]);

  // States for Editing
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  useEffect(() => {
    refreshProducts();
  }, []);

  const refreshProducts = () => {
    getProducts().then(res => {
        setProducts(res);
        setSelectedIds([]); // Reset selection on refresh
    });
  };

  // --- Add Product Logic ---
  const handleAddColorField = () => {
    setColors([...colors, { color: '', stock: '' }]);
  };

  const handleColorChange = (index: number, field: string, value: string) => {
    const newColors: any = [...colors];
    newColors[index][field] = value;
    setColors(newColors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelNo || !price) return alert('أكمل البيانات');

    const res = await addProduct({
        modelNo, description, material, price, status, colors
    });

    if (res.success) {
        alert('تمت الإضافة');
        setModelNo(''); setDescription(''); setMaterial(''); setPrice('');
        setColors([{ color: '', stock: '' }]);
        refreshProducts();
    } else {
        alert('خطأ: ' + res.error);
    }
  };

  // --- Excel Logic ---
  const downloadTemplate = () => {
    // بيانات تجريبية لتوضيح الشكل للمستخدم
    const templateData = [
        { 
            modelNo: "1001", 
            description: "مثال وصف", 
            material: "قطن", 
            color: "أحمر", 
            price: 150, 
            stockQty: 50, 
            status: "OPEN" 
        },
        { 
            modelNo: "1001", 
            description: "نفس الموديل لون اخر", 
            material: "قطن", 
            color: "أزرق", 
            price: 150, 
            stockQty: 30, 
            status: "OPEN" 
        }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Products_Template.xlsx");
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
        
        if(confirm(`تم قراءة ${data.length} صنف. هل تريد حفظهم في قاعدة البيانات؟`)) {
            const res = await addBulkProducts(data);
            if(res.success) {
                alert(`تم استيراد/تحديث ${res.count} صنف بنجاح`);
                refreshProducts();
            } else {
                alert('حدث خطأ: ' + res.error);
            }
        }
    };
    reader.readAsBinaryString(file);
  };

  // --- Delete Logic ---
  const handleDelete = async (id: string) => {
    if (confirm('حذف هذا الصنف نهائياً؟')) {
      await deleteProduct(id);
      refreshProducts();
    }
  };

  const handleDeleteSelected = async () => {
    if(selectedIds.length === 0) return;
    if(confirm(`هل أنت متأكد من حذف ${selectedIds.length} صنف؟`)) {
        await deleteBulkProducts(selectedIds);
        refreshProducts();
    }
  };

  const handleDeleteAll = async () => {
    const confirm1 = confirm("⚠️ تحذير خطير!\nهل أنت متأكد أنك تريد حذف جميع الأصناف من النظام؟");
    if(confirm1) {
        const confirm2 = confirm("هذا الإجراء لا يمكن التراجع عنه. هل أنت متأكد تماماً؟");
        if(confirm2) {
            const res = await deleteAllProducts();
            if(res.success) {
                alert("تم حذف جميع الأصناف.");
                refreshProducts();
            } else {
                alert("خطأ: " + res.error);
            }
        }
    }
  }

  // --- Checkbox Logic ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.checked) {
          setSelectedIds(products.map(p => p.id));
      } else {
          setSelectedIds([]);
      }
  };

  const handleSelectOne = (id: string) => {
      if(selectedIds.includes(id)) {
          setSelectedIds(selectedIds.filter(itemId => itemId !== id));
      } else {
          setSelectedIds([...selectedIds, id]);
      }
  };

  // --- Edit Logic ---
  const handleEditClick = (product: any) => {
      setEditingProduct({ ...product });
      setIsEditModalOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingProduct) return;
      
      const res = await updateProduct(editingProduct.id, editingProduct);
      if(res.success) {
          alert('تم التعديل بنجاح');
          setIsEditModalOpen(false);
          setEditingProduct(null);
          refreshProducts();
      } else {
          alert('خطأ: ' + res.error);
      }
  };

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">إدارة الأصناف والمخزون</h1>
        
        <div className="flex gap-2">
            {selectedIds.length > 0 && (
                <button 
                    onClick={handleDeleteSelected} 
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-bold shadow animate-pulse">
                    حذف المحدد ({selectedIds.length})
                </button>
            )}
            <button 
                onClick={handleDeleteAll} 
                className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded text-sm font-bold shadow">
                ⚠️ حذف جميع الأصناف
            </button>
        </div>
      </div>

      {/* قسم الاستيراد والنموذج */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1">
              <h3 className="font-bold text-blue-800 text-lg mb-1">📥 استيراد من Excel</h3>
              <p className="text-sm text-blue-600 mb-2">يمكنك تحميل ملف وتعديله ثم رفعه مرة أخرى لإضافة كميات كبيرة.</p>
              <button 
                type="button" 
                onClick={downloadTemplate}
                className="bg-white border border-blue-400 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-100 transition flex items-center gap-2">
                📄 تحميل نموذج Excel (Template)
              </button>
          </div>
          <div className="flex-1 flex flex-col items-end">
             <label className="text-sm font-bold text-gray-700 mb-2">رفع الملف المعبأ:</label>
             <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="text-sm bg-white p-2 rounded border cursor-pointer w-full md:w-auto" />
          </div>
      </div>

      {/* Form Adding */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-6 max-w-4xl mx-auto border-t-4 border-green-600">
        <h2 className="font-bold text-gray-700 border-b pb-2">إضافة صنف جديد يدوياً</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-1">
                <label className="block text-xs font-bold text-gray-500 mb-1">رقم الموديل</label>
                <input type="text" className="w-full border p-2 rounded bg-gray-50" value={modelNo} onChange={e => setModelNo(e.target.value)} required />
            </div>
            <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">الوصف</label>
                <input type="text" className="w-full border p-2 rounded" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="col-span-1">
                <label className="block text-xs font-bold text-gray-500 mb-1">سعر البيع</label>
                <input type="number" className="w-full border p-2 rounded font-bold" value={price} onChange={e => setPrice(e.target.value)} required />
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">حالة الطلب</label>
            <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="status" value="OPEN" checked={status === 'OPEN'} onChange={() => setStatus('OPEN')} />
                    <span className="text-green-600 font-bold">مفتوح (طلب دائم)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="status" value="CLOSED" checked={status === 'CLOSED'} onChange={() => setStatus('CLOSED')} />
                    <span className="text-red-600 font-bold">مغلق (حسب المخزون)</span>
                </label>
            </div>
        </div>

        <div className="bg-gray-50 p-4 rounded border">
            <label className="block text-sm font-bold mb-3">الألوان والعدد المتاح</label>
            {colors.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                    <input type="text" placeholder="اللون" className="border p-2 rounded flex-1" value={item.color} onChange={e => handleColorChange(idx, 'color', e.target.value)} required />
                    <input type="number" placeholder="العدد" className="border p-2 rounded w-24 text-center" value={item.stock} onChange={e => handleColorChange(idx, 'stock', e.target.value)} required />
                </div>
            ))}
            <button type="button" onClick={handleAddColorField} className="text-sm text-blue-600 font-bold mt-2">+ إضافة لون</button>
        </div>

        <button type="submit" className="bg-green-600 text-white px-6 py-3 rounded font-bold w-full hover:bg-green-700">حفظ الأصناف</button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-2 bg-gray-50 border-b flex justify-between items-center text-xs text-gray-500">
            <span>عدد الأصناف: {products.length}</span>
            <span>المحدد: {selectedIds.length}</span>
        </div>
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll} 
                    checked={products.length > 0 && selectedIds.length === products.length} 
                  />
              </th>
              <th className="p-3">الموديل</th>
              <th className="p-3">اللون</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">المخزون</th>
              <th className="p-3">السعر</th>
              <th className="p-3 text-center">تحكم</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className={`border-b hover:bg-gray-50 ${selectedIds.includes(p.id) ? 'bg-blue-50' : ''}`}>
                <td className="p-3 text-center">
                    <input 
                        type="checkbox" 
                        checked={selectedIds.includes(p.id)} 
                        onChange={() => handleSelectOne(p.id)} 
                    />
                </td>
                <td className="p-3 font-bold">{p.modelNo}</td>
                <td className="p-3">{p.color}</td>
                <td className="p-3">
                    {p.status === 'CLOSED' ? 
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">مغلق</span> : 
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">مفتوح</span>
                    }
                </td>
                <td className={`p-3 font-bold ${p.stockQty <= 0 ? 'text-red-500' : 'text-blue-600'}`}>{p.stockQty}</td>
                <td className="p-3">{p.price}</td>
                <td className="p-3 flex justify-center gap-2">
                  <button 
                    onClick={() => handleEditClick(p)} 
                    className="text-blue-600 hover:text-blue-800 font-bold bg-blue-100 px-2 py-1 rounded text-xs">
                    تعديل
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)} 
                    className="text-red-600 hover:text-red-800 font-bold bg-red-100 px-2 py-1 rounded text-xs">
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">تعديل بيانات الصنف</h3>
                  <form onSubmit={handleEditSave} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs text-gray-500 mb-1">الموديل</label>
                              <input type="text" className="w-full border p-2 rounded bg-gray-100" value={editingProduct.modelNo} readOnly />
                          </div>
                          <div>
                              <label className="block text-xs text-gray-500 mb-1">اللون</label>
                              <input type="text" className="w-full border p-2 rounded bg-gray-100" value={editingProduct.color} readOnly />
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs text-gray-500 mb-1">الوصف</label>
                          <input type="text" className="w-full border p-2 rounded" value={editingProduct.description || ''} onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs text-gray-500 mb-1">الكمية (المخزون)</label>
                              <input type="number" className="w-full border p-2 rounded" value={editingProduct.stockQty} onChange={(e) => setEditingProduct({...editingProduct, stockQty: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs text-gray-500 mb-1">السعر</label>
                              <input type="number" className="w-full border p-2 rounded" value={editingProduct.price} onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})} />
                          </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">الحالة</label>
                        <select 
                            className="w-full border p-2 rounded"
                            value={editingProduct.status}
                            onChange={(e) => setEditingProduct({...editingProduct, status: e.target.value})}
                        >
                            <option value="OPEN">مفتوح</option>
                            <option value="CLOSED">مغلق</option>
                        </select>
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