'use client'
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchCustomers, getProductsForSearch, createOrder } from '@/app/actions';
import * as XLSX from 'xlsx';

// Define types for better code management
interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Product {
  id: string;
  modelNo: string;
  color: string;
  price: number;
  currentStock: number;
}

interface ParsedRow {
  id: number;
  modelNo: string;
  quantity: number;
  price: number;
  status: 'idle' | 'loading' | 'found' | 'error' | 'multi-color';
  productMatches: Product[];
  selectedProductId?: string;
  errorMessage?: string;
}

export default function BulkUploadPage() {
  const router = useRouter();

  // Global State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Customer State
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // File & Parsed Data State
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');

  // Load all products once on component mount for efficient searching
  useEffect(() => {
    async function fetchProducts() {
      try {
        const products = await getProductsForSearch();
        setAllProducts(products);
      } catch (error) {
        console.error("Failed to load products:", error);
        alert("فشل تحميل بيانات المنتجات. يرجى إعادة تحميل الصفحة.");
      }
      setLoadingProducts(false);
    }
    fetchProducts();
  }, []);

  // Debounced search for customers
  useEffect(() => {
    if (!customerSearch || (selectedCustomer && selectedCustomer.name === customerSearch)) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCustomer(true);
      const results = await searchCustomers(customerSearch);
      setCustomerResults(results);
      setIsSearchingCustomer(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [customerSearch, selectedCustomer]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsedData([]); // Reset previous data

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // FIX: Filter before mapping to allow TypeScript to correctly infer types.
        const rows: ParsedRow[] = json
          .slice(1) // Skip header row
          .filter(row => String(row[0] || '').trim() && parseInt(String(row[1] || '0')) > 0)
          .map((row, index) => ({
            id: index,
            modelNo: String(row[0] || '').trim(),
            quantity: parseInt(String(row[1] || '0')),
            price: parseFloat(String(row[2] || '0')),
            status: 'idle',
            productMatches: [],
          }));

        setParsedData(rows);
        processParsedData(rows);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        alert("حدث خطأ أثناء قراءة ملف الإكسل. تأكد من أنه بالتنسيق الصحيح.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processParsedData = useCallback((data: ParsedRow[]) => {
    if (loadingProducts) return; // Wait for products to be loaded

    const updatedData = data.map(row => {
      const matches = allProducts.filter(p => 
        p.modelNo.toLowerCase() === row.modelNo.toLowerCase()
      );

      if (matches.length === 0) {
        return { ...row, status: 'error' as const, errorMessage: 'الكود غير موجود' };
      }

      if (matches.length === 1) {
        return { ...row, status: 'found' as const, productMatches: matches, selectedProductId: matches[0].id };
      }

      return { ...row, status: 'multi-color' as const, productMatches: matches };
    });

    setParsedData(updatedData);
  }, [allProducts, loadingProducts]);

  useEffect(() => {
    if (parsedData.length > 0 && !loadingProducts) {
      processParsedData(parsedData);
    }
  }, [loadingProducts, parsedData, processParsedData]);


  const handleProductSelection = (rowId: number, selectedProductId: string) => {
    setParsedData(prevData =>
      prevData.map(row =>
        row.id === rowId ? { ...row, selectedProductId, status: 'found' } : row
      )
    );
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      alert("يرجى اختيار العميل أولاً.");
      return;
    }

    const invalidRows = parsedData.filter(row => !row.selectedProductId || row.quantity <= 0);
    if (invalidRows.length > 0) {
      alert("يرجى التأكد من أن جميع الأصناف صحيحة وتم اختيار الألوان اللازمة.");
      return;
    }

    setIsSaving(true);

    // Transform data for createOrder function
    const itemsForOrder = parsedData.map(row => {
        const product = allProducts.find(p => p.id === row.selectedProductId);
        return {
            // This structure mimics the cart item structure
            type: 'product',
            id: Math.random(),
            modelNo: row.modelNo,
            totalQty: row.quantity,
            unitPrice: row.price, // Use price from Excel
            variants: [{
                productId: row.selectedProductId!,
                quantity: row.quantity,
                price: row.price, // Use price from Excel
                color: product?.color || 'N/A',
                discountPercent: 0 // Bulk upload doesn't support discounts from Excel directly
            }]
        };
    });
    
    const total = itemsForOrder.reduce((sum, item) => sum + (item.unitPrice * item.totalQty), 0);

    // Fake the deposit splits for now, can be improved later
    const deposit = 0;
    const depositSplits:any[] = [];

    try {
      const result = await createOrder(
        {
          customerId: selectedCustomer.id,
          items: itemsForOrder,
          total,
          deposit,
          depositSplits,
          voucherAmount: 0,
          currency: "EGP",
          notes: `فاتورة مجمعة من ملف: ${fileName}`,
          createdAt: new Date().toISOString(),
        },
        "user_id_placeholder" // Replace with actual logged-in user ID
      );

      if (result.success) {
        alert("تم إنشاء الفاتورة المجمعة بنجاح!");
        router.push(`/orders/list`);
      } else {
        throw new Error(result.error || "فشل إنشاء الفاتورة.");
      }
    } catch (error: any) {
      console.error("Error creating bulk order:", error);
      alert(`حدث خطأ: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isReadyForSubmit = parsedData.length > 0 && !parsedData.some(p => !p.selectedProductId) && !!selectedCustomer;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <header className="bg-white p-6 rounded-t-xl shadow-md border-b-4 border-purple-600">
          <h1 className="text-2xl font-bold text-gray-800">فاتورة مبيعات مجمعة</h1>
          <p className="text-gray-500 mt-1">ارفع ملف إكسل لإنشاء فاتورة بكميات كبيرة بسرعة.</p>
        </header>

        <main className="bg-white p-6 rounded-b-xl shadow-lg">
          {/* Step 1: Customer Selection */}
          <div className="mb-8">
            <h2 className="font-bold text-lg text-gray-700 mb-2">1. اختر العميل</h2>
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setSelectedCustomer(null);
                }}
                placeholder="ابحث عن عميل بالاسم أو رقم الهاتف..."
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 transition"
                disabled={loadingProducts}
              />
              {isSearchingCustomer && <span className="absolute top-3 left-3 text-sm text-gray-400">...جاري البحث</span>}
              {customerResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border mt-1 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {customerResults.map(c => (
                    <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setCustomerResults([]); }} className="p-3 hover:bg-purple-50 cursor-pointer">
                      <p className="font-bold">{c.name}</p>
                      <p className="text-sm text-gray-500">{c.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div className="bg-purple-50 text-purple-800 p-3 mt-3 rounded-lg font-bold animate-in fade-in">
                العميل المحدد: {selectedCustomer.name}
              </div>
            )}
          </div>

          {/* Step 2: File Upload */}
          <div className="mb-8">
            <h2 className="font-bold text-lg text-gray-700 mb-2">2. ارفع ملف الإكسل</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input type="file" id="file-upload" onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
              <label htmlFor="file-upload" className="cursor-pointer bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition">
                اختر ملف
              </label>
              <p className="text-sm text-gray-500 mt-2">الملف يجب أن يحتوي على الأعمدة: الكود, الكمية, السعر</p>
              {fileName && <p className="mt-2 font-semibold text-green-600">الملف المختار: {fileName}</p>}
            </div>
          </div>

          {/* Step 3: Review and Confirm */}
          {parsedData.length > 0 && (
            <div className="mb-8">
                <h2 className="font-bold text-lg text-gray-700 mb-4">3. مراجعة الأصناف</h2>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-right text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">الكود</th>
                                <th className="px-6 py-3">الكمية</th>
                                <th className="px-6 py-3">السعر</th>
                                <th className="px-6 py-3">الحالة / الاختيار</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parsedData.map((row) => (
                                <tr key={row.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{row.modelNo}</td>
                                    <td className="px-6 py-4">{row.quantity}</td>
                                    <td className="px-6 py-4 font-semibold">{row.price.toFixed(2)} ج.م</td>
                                    <td className="px-6 py-4">
                                        {row.status === 'error' && <span className="font-bold text-red-500">❌ {row.errorMessage}</span>}
                                        {row.status === 'found' && <span className="font-bold text-green-500">✔️ تم العثور عليه</span>}
                                        {row.status === 'multi-color' && (
                                            <select
                                                onChange={(e) => handleProductSelection(row.id, e.target.value)}
                                                defaultValue=""
                                                className="p-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="" disabled>اختر اللون...</option>
                                                {row.productMatches.map(p => (
                                                    <option key={p.id} value={p.id}>{p.color} (متاح: {p.currentStock})</option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {/* Step 4: Submit */}
          <div>
            <button
              onClick={handleSubmit}
              disabled={!isReadyForSubmit || isSaving || loadingProducts}
              className="w-full bg-green-600 text-white font-bold text-lg py-4 px-6 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isSaving ? 'جاري إنشاء الفاتورة...' : 'إنشاء الفاتورة النهائية'}
              {loadingProducts && <span className="text-xs">(جاري تحميل المنتجات)</span>}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
