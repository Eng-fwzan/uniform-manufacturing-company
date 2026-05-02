import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-permission";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";

export default async function DepartmentsPage() {
  await requirePermission("batches.view");
  const departments = Object.keys(DEPARTMENT_LABELS) as DepartmentCode[];

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">أقسام الإنتاج</h1>
        <p className="mt-2 text-slate-600">
          اختر القسم لعرض الدفعات والتحويلات والحركات المرتبطة به.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {departments.map((dept) => (
          <Link
            key={dept}
            href={`/dashboard/departments/${dept}`}
            className="card hover:shadow-lg transition-shadow"
          >
            <div className="text-xs text-slate-500">قسم</div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {DEPARTMENT_LABELS[dept]}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              عرض الدفعات والتحويلات الخاصة بالقسم.
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
