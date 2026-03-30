import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from 'next/navigation';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const settings = await prisma.settings.findFirst();

  async function updateSettings(formData: FormData) {
    "use server";

    const invoiceNotes = formData.get("invoiceNotes") as string;

    await prisma.settings.upsert({
      where: { id: settings?.id || "" },
      update: { invoiceNotes },
      create: { invoiceNotes },
    });

    revalidatePath("/admin/settings");
    redirect('/admin/settings?status=success');
  }

  return (
    <div className="p-4 animate-in fade-in-25">
        {searchParams?.status === 'success' && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800">تم حفظ الملاحظة بنجاح!</p>
            </div>
        )}
      <h1 className="text-2xl font-bold mb-4">إعدادات الفاتورة</h1>
      <form action={updateSettings}>
        <div className="mb-4">
          <label
            htmlFor="invoiceNotes"
            className="block text-sm font-medium text-gray-700"
          >
            ملاحظات الفاتورة
          </label>
          <textarea
            id="invoiceNotes"
            name="invoiceNotes"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            defaultValue={settings?.invoiceNotes || ""}
          />
          <p className="mt-2 text-sm text-gray-500">
            ستظهر هذه الملاحظة في جميع الفواتير المطبوعة.
          </p>
        </div>
        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          حفظ
        </button>
      </form>
    </div>
  );
}