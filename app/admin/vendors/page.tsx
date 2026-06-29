'use client'
import { useEffect, useState } from 'react'
import { getVendors, addVendor, deleteVendor } from '@/app/vendor-actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function VendorsPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newVendor, setNewVendor] = useState({
    name: '',
    phone: '',
    phone2: '',
    code: '',
    address: '',
    notes: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadVendors()
  }, [])

  const loadVendors = async () => {
    const data = await getVendors()
    setVendors(data)
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVendor.name) {
      alert('الاسم مطلوب')
      return
    }

    setIsSaving(true)
    const result = await addVendor(newVendor)
    setIsSaving(false)

    if (result.success) {
      alert('✅ تم إضافة المورد بنجاح')
      setShowAddModal(false)
      setNewVendor({ name: '', phone: '', phone2: '', code: '', address: '', notes: '' })
      loadVendors()
    } else {
      alert('❌ خطأ: ' + result.error)
    }
  }

  const handleDelete = async (vendorId: string, vendorName: string) => {
    if (!confirm(`هل أنت متأكد من حذف المورد: ${vendorName}؟`)) {
      return
    }

    const result = await deleteVendor(vendorId)
    if (result.success) {
      alert('✅ تم الحذف')
      loadVendors()
    } else {
      alert('❌ خطأ: ' + result.error)
    }
  }

  if (loading) {
    return <div className="p-10 text-center font-bold">جاري التحميل...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center border-b-4 border-purple-500">
        <h2 className="font-bold text-lg">🏪 الموردين</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-purple-700"
          >
            ➕ مورد جديد
          </button>
          <Link href="/admin" className="text-sm text-blue-600 font-bold">
            ← رجوع
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {vendors.length === 0 ? (
          <div className="bg-white p-10 rounded-xl shadow text-center">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">لا يوجد موردين</h3>
            <p className="text-gray-500 mb-4">ابدأ بإضافة مورد جديد</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold"
            >
              ➕ إضافة أول مورد
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-right font-bold text-sm">الكود</th>
                  <th className="p-3 text-right font-bold text-sm">الاسم</th>
                  <th className="p-3 text-right font-bold text-sm">الهاتف</th>
                  <th className="p-3 text-center font-bold text-sm">المنتجات</th>
                  <th className="p-3 text-center font-bold text-sm">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-sm">{vendor.code}</td>
                    <td className="p-3 font-bold">{vendor.name}</td>
                    <td className="p-3 text-sm text-gray-600">{vendor.phone || '-'}</td>
                    <td className="p-3 text-center">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        {vendor._count.products}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <Link
                          href={`/admin/vendors/${vendor.id}`}
                          className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold hover:bg-blue-200"
                        >
                          📊 كشف حساب
                        </Link>
                        <Link
                          href={`/admin/payments/new?vendorId=${vendor.id}`}
                          className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-200"
                        >
                          💰 سند دفع
                        </Link>
                        <button
                          onClick={() => handleDelete(vendor.id, vendor.name)}
                          className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-bold hover:bg-red-200"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal إضافة مورد */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b pb-2 text-center text-purple-900">
              ➕ إضافة مورد جديد
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  اسم المورد (مطلوب)
                </label>
                <input
                  type="text"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="w-full border p-3 rounded-xl shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  كود المورد (تلقائي لو تركته فارغاً)
                </label>
                <input
                  type="text"
                  value={newVendor.code}
                  onChange={(e) => setNewVendor({ ...newVendor, code: e.target.value })}
                  className="w-full border p-3 rounded-xl bg-gray-50 shadow-sm"
                  placeholder="سيتم التوليد تلقائياً"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">هاتف 1</label>
                  <input
                    type="text"
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                    className="w-full border p-3 rounded-xl shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">هاتف 2</label>
                  <input
                    type="text"
                    value={newVendor.phone2}
                    onChange={(e) => setNewVendor({ ...newVendor, phone2: e.target.value })}
                    className="w-full border p-3 rounded-xl shadow-sm bg-yellow-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">العنوان</label>
                <input
                  type="text"
                  value={newVendor.address}
                  onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                  className="w-full border p-3 rounded-xl shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات</label>
                <textarea
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })}
                  className="w-full border p-3 rounded-xl shadow-sm"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-100 py-3 rounded-lg font-bold hover:bg-gray-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-purple-700"
                >
                  {isSaving ? '⏳ جاري الحفظ...' : 'حفظ ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
