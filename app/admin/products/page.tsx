'use client'
import { useState, useEffect } from 'react';
import { addProduct, getProducts, deleteProduct } from '@/app/admin-actions';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  
  // Form State
  const [modelNo, setModelNo] = useState('');
  const [description, setDescription] = useState('');
  const [material, setMaterial] = useState('');
  const [price, setPrice] = useState('');
  
  // Colors State (لإضافة أكثر من لون لنفس الموديل)
  const [colors, setColors] = useState([{ color: '', stock: '' }]);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

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
    if (!modelNo || !price) return alert('أكمل البيانات الأساسية');

    const res = await addProduct({
        modelNo, description, material, price, colors
    });

    if (res.success) {
        alert('تمت إضافة الأصناف');
        // Reset
        setModelNo(''); setDescription(''); setMaterial(''); setPrice('');
        setColors([{ color: '', stock: '' }]);
        getProducts().then(setProducts);
    } else {
        alert('خطأ: ' + res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('حذف هذا الصنف؟')) {
      await deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">إدارة الأصناف والمخزون</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-6 max-w-3xl border-t-4 border-green-600">
        
        {/* البيانات الأساسية */}
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

        {/* الألوان والمخزون */}
        <div className="bg-gray-50 p-4 rounded border">
            <label className="block text-sm font-bold mb-3">الألوان والعدد المتاح</label>
            {colors.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                    <input 
                        type="text" placeholder="اللون (أحمر، كحلي..)" 
                        className="border p-2 rounded flex-1"
                        value={item.color}
                        onChange={e => handleColorChange(idx, 'color', e.target.value)}
                        required
                    />
                    <input 
                        type="number" placeholder="العدد" 
                        className="border p-2 rounded w-24 text-center"
                        value={item.stock}
                        onChange={e => handleColorChange(idx, 'stock', e.target.value)}
                        required
                    />
                </div>
            ))}
            <button type="button" onClick={handleAddColorField} className="text-sm text-blue-600 font-bold mt-2">+ إضافة لون آخر</button>
        </div>

        <button type="submit" className="bg-green-600 text-white px-6 py-3 rounded font-bold w-full hover:bg-green-700">حفظ الأصناف</button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3">الموديل</th>
              <th className="p-3">اللون</th>
              <th className="p-3">العدد</th>
              <th className="p-3">السعر</th>
              <th className="p-3">تحكم</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-bold">{p.modelNo}</td>
                <td className="p-3">{p.color}</td>
                <td className="p-3 font-bold text-blue-600">{p.stockQty}</td>
                <td className="p-3">{p.price}</td>
                <td className="p-3">
                  <button onClick={() => handleDelete(p.id)} className="text-red-500 font-bold">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}