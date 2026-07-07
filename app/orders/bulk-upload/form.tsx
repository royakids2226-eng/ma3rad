'use client'
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchCustomers, getProductsForSearch } from '@/app/actions';
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
  quantity: number; // Can be positive (sale) or negative (return)
  price: number;
  status: 'idle' | 'loading' | 'found' | 'error' | 'multi-color';
  productMatches: Product[];
  selectedProductId?: string;
  errorMessage?: string;
}

export default function BulkUploadForm({ userId }: { userId: string }) {
  const router = useRouter();

  // Global State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isProceeding, setIsProceeding] = useState(false); // Renamed from isSaving

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

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const rows: ParsedRow[] = json
          .slice(1) // Skip header row
          .filter(row => {
            const modelNo = String(row[0] || '').trim();
            const quantity = parseInt(String(row[1] || '0'));
            const price = parseFloat(String(row[2] || '0'));
            return modelNo && !isNaN(quantity) && quantity !== 0 && !isNaN(price);
          })
          .map((row, index) => ({
            id: index,
            modelNo: String(row[0] || '').trim(),
            quantity: parseInt(String(row[1] || '0')),
            price: parseFloat(String(row[2] || '0')),
            status: 'idle',
            productMatches: [],
          }));

        if (rows.length === 0) {
          alert("لم يتم العثور على أي أصناف صالحة في الملف. يرجى التأكد من أن الملف يحتوي على الأعمدة المطلوبة (الكود، الكمية، السعر) وأن الكميات ليست صفراً.");
          setFileName('');
          return;
        }

        setParsedData(rows);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        alert("حدث خطأ أثناء قراءة ملف الإكسل. تأكد من أنه بالتنسيق الصحيح.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processData = useCallback((data: ParsedRow[]): ParsedRow[] => {
    if (loadingProducts) return data;

    return data.map(row => {
      if (row.status !== 'idle') return row;

      const matches = allProducts.filter(p => p.modelNo.toLowerCase() === row.modelNo.toLowerCase());

      if (matches.length === 0) {
        return { ...row, status: 'error', errorMessage: 'الكود غير موجود' };
      }

      if (matches.length === 1) {
        const product = matches[0];
        if (row.quantity > 0 && row.quantity > product.currentStock) {
          return { ...row, status: 'error', errorMessage: `الكمية أكبر من المتاح (${product.currentStock})` };
        }
        return { ...row, status: 'found', productMatches: matches, selectedProductId: product.id };
      }

      return { ...row, status: 'multi-color', productMatches: matches };
    });
  }, [allProducts, loadingProducts]);

  useEffect(() => {
    const needsProcessing = parsedData.some(row => row.status === 'idle');
    if (needsProcessing && !loadingProducts) {
      const processedData = processData(parsedData);
      setParsedData(processedData);
    }
  }, [parsedData, loadingProducts, processData]);

  const handleProductSelection = (rowId: number, selectedProductId: string) => {
    setParsedData(prevData =>
      prevData.map(row => {
        if (row.id === rowId) {
          const product = allProducts.find(p => p.id === selectedProductId);
          if (product && row.quantity > 0 && row.quantity > product.currentStock) {
            return { ...row, selectedProductId, status: 'error' as const, errorMessage: `الكمية أكبر من المتاح (${product.currentStock})` };
          }
          return { ...row, selectedProductId, status: 'found' as const, errorMessage: undefined };
        }
        return row;
      })
    );
  };
  
  const handleProceed = () => {
    if (!selectedCustomer) {
      alert("يرجى اختيار العميل أولاً.");
      return;
    }

    const invalidRows = parsedData.filter(row => row.status !== 'found');
    if (invalidRows.length > 0) {
      alert("يرجى التأكد من أن جميع الأصناف صحيحة وتم اختيار الألوان ومعالجة الأخطاء.");
      return;
    }

    setIsProceeding(true);

    const itemsForCart = parsedData.map(row => {
      const product = allProducts.find(p => p.id === row.selectedProductId)!;
      const unitPrice = row.price; 
      
      return {
          productId: product.id,
          modelNo: product.modelNo,
          color: product.color,
          quantity: row.quantity,
          price: unitPrice,
          currentStock: product.currentStock,
          discountPercent: 0
      };
    });

    const bulkData = {
        customer: selectedCustomer,
        items: itemsForCart
    };
    
    try {
        sessionStorage.setItem('bulkOrderData', JSON.stringify(bulkData));
        router.push('/orders/new');
    } catch (error) {
        console.error("Failed to save data to sessionStorage or redirect:", error);
        alert("حدث خطأ أثناء محاولة الانتقال لصفحة الأوردر الجديد.");
        setIsProceeding(false);
    }
  };

  const isReadyForSubmit = parsedData.length > 0 && !parsedData.some(p => p.status !== 'found') && !!selectedCustomer;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <header className="bg-white p-6 rounded-t-xl shadow-md border-b-4 border-purple-600">
          <h1 className="text-2xl font-bold text-gray-800">فاتورة مجمعة (الخطوة 1 من 2)</h1>
          <p className="text-gray-500 mt-1">ارفع ملف إكسل لتحضير الأصناف، ثم استكمل تفاصيل الأوردر في الخطوة التالية.</p>
        </header>

        <main className="bg-white p-6 rounded-b-xl shadow-lg">
          <div className="mb-8">
            <h2 className="font-bold text-lg text-gray-700 mb-2">أ. اختر العميل</h2>
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
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

          <div className="mb-8">
            <h2 className="font-bold text-lg text-gray-700 mb-2">ب. ارفع ملف الإكسل</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input type="file" id="file-upload" onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
              <label htmlFor="file-upload" className="cursor-pointer bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition">
                اختر ملف
              </label>
              <p className="text-sm text-gray-500 mt-2">الأعمدة: الكود, الكمية (موجب للبيع, سالب للمرتجع), السعر</p>
              {fileName && <p className="mt-2 font-semibold text-green-600">الملف المختار: {fileName}</p>}
            </div>
          </div>

          {parsedData.length > 0 && (
            <div className="mb-8">
              <h2 className="font-bold text-lg text-gray-700 mb-4">ج. مراجعة الأصناف</h2>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-right text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">النوع</th>
                      <th className="px-6 py-3">الكود</th>
                      <th className="px-6 py-3">الكمية</th>
                      <th className="px-6 py-3">السعر</th>
                      <th className="px-6 py-3">الحالة / الاختيار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row) => (
                      <tr key={row.id} className={`${row.quantity > 0 ? 'bg-white' : 'bg-red-50'} border-b hover:bg-gray-50`}>
                        <td className="px-6 py-4 font-bold">
                          {row.quantity > 0
                            ? <span className="text-green-600">بيع</span>
                            : <span className="text-red-600">مرتجع</span>}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{row.modelNo}</td>
                        <td className="px-6 py-4 font-bold">{row.quantity}</td>
                        <td className="px-6 py-4 font-semibold">{Math.abs(row.price).toFixed(2)} ج.م</td>
                        <td className="px-6 py-4">
                          {row.status === 'error' && <span className="font-bold text-red-500">❌ {row.errorMessage}</span>}
                          {row.status === 'found' && (
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-green-500">✔️ جاهز</span>
                                {row.productMatches.length === 1 && <span className="text-xs text-gray-500">({row.productMatches[0].color})</span>}
                            </div>
                          )}
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
                          {row.status === 'idle' && <span className="text-gray-400">...جاري المعالجة</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <button
              onClick={handleProceed}
              disabled={!isReadyForSubmit || isProceeding || loadingProducts}
              className="w-full bg-blue-600 text-white font-bold text-lg py-4 px-6 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isProceeding ? 'جاري التجهيز...' : 'متابعة لإنشاء أوردر'}
              {loadingProducts && <span className="text-xs">(جاري تحميل المنتجات)</span>}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
