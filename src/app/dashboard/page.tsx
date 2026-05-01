import { getCurrentUser } from "@/lib/auth/current-user";
import { USER_ROLE_LABELS } from "@/lib/types/database";

export default async function DashboardHomePage() {
  const user = await getCurrentUser();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          مرحبًا، {user?.full_name}
        </h1>
        <p className="text-slate-600 mt-1">
          {user && USER_ROLE_LABELS[user.role]} · لوحة التحكم
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="طلبات نشطة" value="—" hint="Phase 1" />
        <StatCard label="دفعات اليوم" value="—" hint="Phase 1" />
        <StatCard label="فروقات هذا الأسبوع" value="—" hint="Phase 1" />
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">حالة النظام</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span>Phase 0 — البنية الأساسية + المصادقة + الصلاحيات + Audit Log</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-slate-400">○</span>
            <span className="text-slate-500">
              Phase 1 — MVP خط الإنتاج (الطلبات + الدفعات + التسليم/الاستلام)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-slate-400">○</span>
            <span className="text-slate-500">Phase 2 — المشتريات والمخزون</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-slate-400">○</span>
            <span className="text-slate-500">Phase 3 — التسليم والفواتير والعينات</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-slate-400">○</span>
            <span className="text-slate-500">Phase 4 — التحليلات والكتالوج</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="text-3xl font-bold text-slate-900 mt-2">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
