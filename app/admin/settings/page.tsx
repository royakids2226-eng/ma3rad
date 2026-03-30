import { getSettings, updateSettings } from "@/app/actions";
import { redirect } from 'next/navigation';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const settings = await getSettings();

  async function handleSubmit(formData: FormData) {
    "use server";

    const data = {
      siteName: formData.get("siteName") as string,
      invoiceNotes: formData.get("invoiceNotes") as string,
      header: formData.get("header") as string,
      footer: formData.get("footer") as string,
    };

    const result = await updateSettings(data);

    if (result.success) {
      redirect('/admin/settings?status=success');
    } else {
      redirect(`/admin/settings?status=error&message=${result.error}`);
    }
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in-25" dir="rtl">
        {searchParams?.status === 'success' && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800">تم حفظ الإعدادات بنجاح!</p>
            </div>
        )}
        {searchParams?.status === 'error' && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">
                    فشل الحفظ: {searchParams.message}
                </p>
            </div>
        )}

      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800 border-b pb-3">إعدادات النظام والفواتير</h1>
      
      <form action={handleSubmit} className="space-y-8">
        
        <div>
          <label
            htmlFor="siteName"
            className="block text-base font-semibold text-gray-800 mb-2"
          >
            اسم المعرض/الشركة
          </label>
          <input
            id="siteName"
            name="siteName"
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            defaultValue={settings?.siteName || ""}
          />
          <p className="mt-2 text-sm text-gray-500">
            الاسم الذي يظهر في رأس الفاتورة الرقمية (PDF).
          </p>
        </div>

        <div>
          <label
            htmlFor="header"
            className="block text-base font-semibold text-gray-800 mb-2"
          >
            محتوى ترويسة الفاتورة (Header)
          </label>
          <textarea
            id="header"
            name="header"
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            defaultValue={settings?.header || ""}
          />
          <p className="mt-2 text-sm text-gray-500">
            محتوى يظهر في الجزء العلوي من الفاتورة الرقمية (PDF).
          </p>
        </div>

        <div>
          <label
            htmlFor="footer"
            className="block text-base font-semibold text-gray-800 mb-2"
          >
            محتوى تذييل الفاتورة (Footer)
          </label>
          <textarea
            id="footer"
            name="footer"
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            defaultValue={settings?.footer || ""}
          />
          <p className="mt-2 text-sm text-gray-500">
            محتوى يظهر في الجزء السفلي من الفاتورة الرقمية (PDF).
          </p>
        </div>

        <div>
          <label
            htmlFor="invoiceNotes"
            className="block text-base font-semibold text-gray-800 mb-2"
          >
            ملاحظات الفاتورة العامة
          </label>
          <textarea
            id="invoiceNotes"
            name="invoiceNotes"
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            defaultValue={settings?.invoiceNotes || ""}
          />
          <p className="mt-2 text-sm text-gray-500">
            نص عام يظهر في قسم الملاحظات بجميع الفواتير.
          </p>
        </div>

        <div className="pt-4">
            <button
              type="submit"
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-3 px-8 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              حفظ الإعدادات
            </button>
        </div>
      </form>
    </div>
  );
}
