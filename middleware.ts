
import { withAuth, NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(request: NextRequestWithAuth) {
    const { token } = request.nextauth;
    const { pathname } = request.nextUrl;

    // المسارات المسموح بها لجميع المستخدمين المسجلين (بما في ذلك الموظفين)
    const universallyAllowedPaths = [
      "/admin/purchases/new",
      "/admin/purchases/returns/new",
    ];

    // تحقق إذا كان المسار المطلوب ضمن المسارات المسموح بها للجميع
    if (universallyAllowedPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next(); // اسمح بالمرور لأي مستخدم مسجل دخوله
    }

    // الأدوار الإدارية المسموح لها بالوصول لبقية لوحة التحكم
    const adminRoles = ["ADMIN", "OWNER", "ACCOUNTANT"];

    // إذا كان المسار يتطلب صلاحيات إدارية والمستخدم لا يملكها
    if (pathname.startsWith("/admin") && !adminRoles.includes(token?.role as string)) {
      // أعد توجيهه إلى الصفحة الرئيسية لتطبيق البيع
      return NextResponse.redirect(new URL("/", request.url));
    }

    // اسمح بالمرور في جميع الحالات الأخرى
    return NextResponse.next();
  },
  {
    callbacks: {
      // التأكد من أن المستخدم مسجل دخوله للوصول إلى أي صفحة يتم تطبيق الـ middleware عليها
      authorized: ({ token }) => !!token,
    },
  }
);

// تطبيق هذا الـ middleware على جميع المسارات داخل /admin
export const config = {
  matcher: ["/admin/:path*"],
};
