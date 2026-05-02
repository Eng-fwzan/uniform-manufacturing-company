import Link from "next/link";
import { APP_NAME, COMPANY_LOGO_PATH, COMPANY_NAME } from "@/lib/brand";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-100">
      <div className="max-w-4xl w-full space-y-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <img
            src={COMPANY_LOGO_PATH}
            alt={COMPANY_NAME}
            className="h-24 w-24 rounded-full border border-slate-200 bg-white object-cover shadow-sm"
          />
          <div>
            <div className="text-sm font-medium text-brand-600">بوابة الدخول</div>
            <h1 className="mt-2 text-3xl md:text-5xl font-bold text-slate-900">
              {APP_NAME}
            </h1>
            <p className="mt-3 text-base md:text-lg text-slate-600">
              اختر طريقة الدخول المناسبة للجهاز. هذه الصفحة هي نقطة البداية الوحيدة للنظام.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link href="/login?redirect=%2Fdashboard" className="card min-h-56 hover:shadow-md transition-shadow text-right flex flex-col justify-between">
            <div>
              <div className="text-4xl mb-4">💻</div>
              <h2 className="text-2xl font-bold text-slate-900">دخول الكمبيوتر</h2>
              <p className="mt-2 text-sm md:text-base text-slate-600">
                لوحة الإدارة، الطلبات، الدفعات، المشتريات، المخزون، التقارير، والمستخدمون.
              </p>
            </div>
            <div className="mt-6 btn-tablet btn-primary text-center">فتح لوحة الكمبيوتر</div>
          </Link>

          <Link href="/tablet" className="card min-h-56 hover:shadow-md transition-shadow text-right flex flex-col justify-between">
            <div>
              <div className="text-4xl mb-4">📱</div>
              <h2 className="text-2xl font-bold text-slate-900">دخول التابلت</h2>
              <p className="mt-2 text-sm md:text-base text-slate-600">
                واجهة الأقسام لأرض المصنع: اختيار القسم، PIN، استلام وتسليم الدفعات.
              </p>
            </div>
            <div className="mt-6 btn-tablet btn-secondary text-center">فتح واجهة التابلت</div>
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
          عند تشغيل النظام محليًا استخدم نفس العنوان دائمًا، ويفضل: <span dir="ltr" className="font-semibold text-slate-900">http://127.0.0.1:3000</span>
        </div>
      </div>
    </main>
  );
}
