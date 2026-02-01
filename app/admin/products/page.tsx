'use client'
import { useState, useEffect, useMemo } from 'react';
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
  const [searchTerm, setSearchTerm] = useState(''); // 👈 الميزة الجديدة: حالة البحث اللايف
  
  // Adding States
  const [modelNo, setModelNo] = useState('');
  const [description, setDescription] = useState('');
  const [material, setMaterial] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [colors, setColors] = useState([{ color: '', stock: '' }]);

  // Edit States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  // Deleting State
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    refreshProducts();
  }, []);

  const refreshProducts = () => {
    getProducts().then(res => {
        setProducts(res);
        setSelectedIds([]);
    });
  };

  // 👇 الميزة الجديدة: منطق تصفية الأصناف (Live Search) 👇
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
        p.modelNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.color && p.color.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

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

  // --- Excel Logic (موجودة بالكامل) ---
  const downloadTemplate = () => {
    const templateData = [
        { modelNo: "1001", description: "وصف", material: "قطن", color: "أحمر", price: 150, stockQty: 50, status: "OPEN" },
        { modelNo: "1001", description: "نفس الموديل", material: "قطن", color: "أزرق", price: 150, stockQty: 30, status: "OPEN" }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Products_Template.xlsx");
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if(!file) return;

    setUploadProgress(0);
    setUploadStatusText('');
    
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if(confirm(`تم قراءة ${data.length} صنف. هل تريد البدء في الرفع؟`)) {
            setIsUploading(true);
            const BATCH_SIZE = 200;
            let successCount = 0;
            const total = data.length;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                const chunk = data.slice(i, i + BATCH_SIZE);
                setUploadStatusText(`جاري رفع الأصناف من ${i + 1} إلى ${Math.min(i + BATCH_SIZE, total)} ...`);
                
                const res = await addBulkProducts(chunk as any[]);
                if (res.success) {
                    successCount += (res.count || 0);
                }

                const percent = Math.round(((i + chunk.length) / total) * 100);
                setUploadProgress(percent);
            }

            setIsUploading(false);
            setUploadStatusText(`✅ تم الانتهاء! تم رفع/تحديث ${successCount} صنف بنجاح.`);
            alert(`تمت العملية بنجاح. تم معالجة ${successCount} صنف.`);
            refreshProducts();
            e.target.value = '';
        }
    };
    reader.readAsBinaryString(file);
  };

  // --- Delete Logic (موجودة بالكامل) ---
  const handleDelete = async (id: string) => {
    if (confirm('حذف هذا الصنف نهائياً؟')) {
      setIsDeleting(true);
      const res = await deleteProduct(id);
      setIsDeleting(false);

      if(res.success) {
          refreshProducts();
      } else {
          alert('❌ فشل الحذف: ' + res.error);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if(selectedIds.length === 0) return;
    if(confirm(`هل أنت متأكد من محاولة حذف ${selectedIds.length} صنف؟`)) {
        setIsDeleting(true);
        const res = await deleteBulkProducts(selectedIds);
        setIsDeleting(false);

        if(res.success) {
            alert(`✅ تقرير الحذف:\n- تم حذف: ${res.deleted} صنف.\n- فشل حذف: ${res.failed} صنف (مرتبطة بطلبات بيع).`);
            refreshProducts();
        } else {
            alert('حدث خطأ غير متوقع');
        }
    }
  };

  const handleDeleteAll = async () => {
    const confirm1 = confirm("⚠️ تحذير خطير!\nهل أنت متأكد أنك تريد حذف جميع الأصناف من النظام؟");
    if(confirm1) {
        if(confirm("سيتم حذف الأصناف التي ليس لها مبيعات فقط.\nهل تريد الاستمرار؟")) {
            setIsDeleting(true);
            const res = await deleteAllProducts();
            setIsDeleting(false);

            if(res.success) {
                alert(`✅ تقرير الحذف الشامل:\n- تم حذف: ${res.deleted} صنف.\n- متبقي: ${res.failed} صنف.`);
                refreshProducts();
            } else {
                alert("خطأ: " + res.error);
            }
        }
    }
  }

  // Helper Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.checked) setSelectedIds(filteredProducts.map(p => p.id));
      else setSelectedIds([]);
  };

  const handleSelectOne = (id: string) => {
      if(selectedIds.includes(id)) setSelectedIds(selectedIds.filter(itemId => itemId !== id));
      else setSelectedIds([...selectedIds, id]);
  };

  // Edit Logic
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
    <div className="space-y-6 relative pb-20" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded shadow-sm border-r-4 border-r-green-600">
        <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">إدارة الأصناف</h1>
            <p className="text-xs text-green-600 font-bold mt-1">العدد المتاح: {filteredProducts.length}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* 👇 حقل البحث اللايف الجديد 👇 */}
            <div className="w-full md:w-64">
                <input 
                    type="text" 
                    placeholder="🔍 بحث برقم الموديل أو اللون..." 
                    className="w-full p-2 border-2 border-green-200 rounded-lg focus:border-green-500 outline-none text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {selectedIds.length > 0 && (
                <button 
                    onClick={handleDeleteSelected} 
                    disabled={isDeleting}
                    className={`flex-1 md:flex-none text-white px-4 py-2 rounded text-sm font-bold shadow transition-all ${isDeleting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 animate-pulse'}`}>
                    {isDeleting ? '⏳...' : `حذف (${selectedIds.length})`}
                </button>
            )}
            <button 
                onClick={handleDeleteAll} 
                disabled={isDeleting}
                className={`flex-1 md:flex-none text-white px-4 py-2 rounded text-sm font-bold shadow transition-all ${isDeleting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-800 hover:bg-red-900'}`}>
                {isDeleting ? '⏳...' : '⚠️ حذف الكل'}
            </button>
        </div>
      </div>

      {/* Upload Section (موجودة بالكامل) */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
            <div className="w-full">
                <h3 className="font-bold text-blue-800 text-sm md:text-lg">📥 استيراد Excel</h3>
                <div className="flex justify-between items-center mt-1">
                    <button onClick={downloadTemplate} className="text-xs text-blue-700 underline font-bold">تحميل النموذج</button>
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isUploading || isDeleting} className="text-xs bg-white p-2 rounded border cursor-pointer w-1/2" />
                </div>
            </div>
          </div>

          {(isUploading || uploadProgress > 0) && (
             <div className="w-full bg-white p-2 rounded shadow-sm border border-blue-100 mt-2">
                <div className="flex justify-between text-[10px] font-bold text-blue-800 mb-1">
                    <span>{uploadStatusText}</span>
                    <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out striped-progress" style={{ width: `${uploadProgress}%` }}></div>
                </div>
             </div>
          )}
      </div>

      {/* Form Adding (موجودة بالكامل) */}
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow space-y-4 border-t-4 border-green-600">
        <h2 className="font-bold text-gray-700 text-sm border-b pb-2">إضافة صنف يدوياً</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-1"><label className="block text-xs font-bold text-gray-500 mb-1">الموديل</label><input type="text" className="w-full border p-2 rounded bg-gray-50 focus:bg-white" value={modelNo} onChange={e => setModelNo(e.target.value)} required /></div>
            <div className="col-span-1"><label className="block text-xs font-bold text-gray-500 mb-1">السعر</label><input type="number" className="w-full border p-2 rounded font-bold focus:bg-white" value={price} onChange={e => setPrice(e.target.value)} required /></div>
            <div className="col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">الوصف</label><input type="text" className="w-full border p-2 rounded focus:bg-white" value={description} onChange={e => setDescription(e.target.value)} /></div>
        </div>
        
        {/* حالة الطلب */}
        <div className="flex gap-4 items-center bg-gray-50 p-2 rounded">
             <span className="text-xs font-bold text-gray-500">الحالة:</span>
             <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="status" value="OPEN" checked={status === 'OPEN'} onChange={() => setStatus('OPEN')} /><span className="text-green-600 text-xs font-bold">مفتوح</span></label>
             <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="status" value="CLOSED" checked={status === 'CLOSED'} onChange={() => setStatus('CLOSED')} /><span className="text-red-600 text-xs font-bold">مغلق</span></label>
        </div>

        <div className="bg-gray-50 p-3 rounded border">
            <label className="block text-xs font-bold mb-2">الألوان والمخزون</label>
            {colors.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                    <input type="text" placeholder="اللون" className="border p-2 rounded flex-1 text-sm" value={item.color} onChange={e => handleColorChange(idx, 'color', e.target.value)} required />
                    <input type="number" placeholder="العدد" className="border p-2 rounded w-20 text-center text-sm" value={item.stock} onChange={e => handleColorChange(idx, 'stock', e.target.value)} required />
                </div>
            ))}
            <button type="button" onClick={handleAddColorField} className="text-xs text-blue-600 font-bold mt-1">+ إضافة لون</button>
        </div>
        <button type="submit" disabled={isDeleting} className="bg-green-600 text-white px-6 py-3 rounded font-bold w-full hover:bg-green-700 disabled:opacity-50 transition">حفظ</button>
      </form>

      {/* --- Responsive List (موجودة بالكامل) --- */}
      <div className="relative">
        {isDeleting && (
            <div className="absolute inset-0 bg-white bg-opacity-80 z-20 flex justify-center items-center rounded-lg">
                <div className="text-red-600 font-bold text-lg animate-pulse">⏳ جاري الحذف...</div>
            </div>
        )}

        {/* 1. Mobile View (Cards) */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
            <div className="flex justify-between items-center px-2">
                <span className="text-xs font-bold text-gray-500">العدد المصفى: {filteredProducts.length}</span>
                <label className="flex items-center gap-2 text-xs font-bold bg-gray-100 px-3 py-1 rounded">
                    <input type="checkbox" onChange={handleSelectAll} checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length} />
                    تحديد المعروض
                </label>
            </div>
            {filteredProducts.map(p => (
                <div key={p.id} className={`bg-white p-4 rounded-lg shadow border-l-4 ${selectedIds.includes(p.id) ? 'border-l-blue-500 bg-blue-50' : 'border-l-gray-300'}`}>
                    <div className="flex justify-between items-start mb-2">
                         <div className="flex items-center gap-3">
                            <input type="checkbox" className="w-5 h-5" checked={selectedIds.includes(p.id)} onChange={() => handleSelectOne(p.id)} />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-gray-800 text-lg">{p.modelNo}</h3>
                                    {p.status === 'CLOSED' && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">مغلق</span>}
                                </div>
                                <span className="text-xs text-gray-500">{p.color}</span>
                            </div>
                         </div>
                         <div className="text-left">
                             <div className="font-bold text-blue-600 text-lg">{p.price} ج.م</div>
                             <div className={`text-xs font-bold ${p.stockQty > 0 ? 'text-green-600' : 'text-red-500'}`}>متاح: {p.stockQty}</div>
                         </div>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                        <span className="text-xs text-gray-400">ID: {p.id.substring(0, 6)}</span>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick(p)} className="bg-blue-100 text-blue-600 px-3 py-1 rounded text-xs font-bold">تعديل</button>
                            <button onClick={() => handleDelete(p.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-bold">حذف</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* 2. Desktop View (Table) */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="p-2 bg-gray-50 border-b flex justify-between items-center text-xs text-gray-500">
                <span>عدد الأصناف المصفاة: {filteredProducts.length}</span>
                <span>المحدد: {selectedIds.length}</span>
            </div>
            <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 text-gray-700">
                <tr>
                <th className="p-3 w-10 text-center"><input type="checkbox" onChange={handleSelectAll} checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length} /></th>
                <th className="p-3">الموديل</th>
                <th className="p-3">اللون</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">المخزون</th>
                <th className="p-3">السعر</th>
                <th className="p-3 text-center">تحكم</th>
                </tr>
            </thead>
            <tbody>
                {filteredProducts.map(p => (
                <tr key={p.id} className={`border-b hover:bg-gray-50 ${selectedIds.includes(p.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-3 text-center"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => handleSelectOne(p.id)} /></td>
                    <td className="p-3 font-bold">{p.modelNo}</td>
                    <td className="p-3">{p.color}</td>
                    <td className="p-3">{p.status === 'CLOSED' ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">مغلق</span> : <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">مفتوح</span>}</td>
                    <td className={`p-3 font-bold ${p.stockQty <= 0 ? 'text-red-500' : 'text-blue-600'}`}>{p.stockQty}</td>
                    <td className="p-3">{p.price}</td>
                    <td className="p-3 flex justify-center gap-2">
                    <button onClick={() => handleEditClick(p)} className="text-blue-600 hover:text-blue-800 font-bold bg-blue-100 px-2 py-1 rounded text-xs">تعديل</button>
                    <button onClick={() => handleDelete(p.id)} disabled={isDeleting} className="text-red-600 hover:text-red-800 font-bold bg-red-100 px-2 py-1 rounded text-xs disabled:opacity-50">حذف</button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {/* Edit Modal (موجودة بالكامل) */}
      {isEditModalOpen && editingProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
                  <h3 className="font-bold border-b pb-2 text-lg">تعديل بيانات الصنف</h3>
                  <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-500">الموديل</label><input type="text" className="w-full border p-2 rounded bg-gray-100" value={editingProduct.modelNo} readOnly /></div>
                      <div><label className="text-xs text-gray-500">اللون</label><input type="text" className="w-full border p-2 rounded bg-gray-100" value={editingProduct.color} readOnly /></div>
                  </div>
                  <div><label className="text-xs text-gray-500">الوصف</label><input type="text" className="w-full border p-2 rounded" value={editingProduct.description || ''} onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-500">الكمية</label><input type="number" className="w-full border p-2 rounded font-bold" value={editingProduct.stockQty} onChange={(e) => setEditingProduct({...editingProduct, stockQty: e.target.value})} /></div>
                      <div><label className="text-xs text-gray-500">السعر</label><input type="number" className="w-full border p-2 rounded font-bold" value={editingProduct.price} onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})} /></div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">الحالة</label>
                    <select className="w-full border p-2 rounded bg-white" value={editingProduct.status} onChange={(e) => setEditingProduct({...editingProduct, status: e.target.value})}>
                        <option value="OPEN">مفتوح</option>
                        <option value="CLOSED">مغلق</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded font-bold">إلغاء</button>
                      <button onClick={handleEditSave} className="px-4 py-2 text-white bg-blue-600 rounded font-bold">حفظ</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}