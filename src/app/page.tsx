import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-bl from-brand-50 to-white">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
            نظام إدارة مصنع الزي الموحد
          </h1>
          <p className="text-lg text-slate-600">
            On-Premise + تابلت Touch-Friendly · تتبع دفعات بكود B-YYYY-XXXXXX
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/login" className="card hover:shadow-md transition-shadow text-right">
            <div className="text-2xl mb-2">💻</div>
            <h2 className="text-xl font-semibold mb-1">دخول الكمبيوتر</h2>
            <p className="text-sm text-slate-600">للإدارة ومدير الإنتاج والمحاسب</p>
          </Link>

          <Link href="/tablet" className="card hover:shadow-md transition-shadow text-right">
            <div className="text-2xl mb-2">📱</div>
            <h2 className="text-xl font-semibold mb-1">دخول التابلت</h2>
            <p className="text-sm text-slate-600">لأرض المصنع — استلام/تسليم بـ PIN</p>
          </Link>
        </div>

        <div className="text-sm text-slate-500 pt-4 border-t border-slate-200">
          الخماسية الأساسية: الطلب · البنود · الدفعات · الحركات · الأرشفة
        </div>
      </div>
    </main>
  );
}
