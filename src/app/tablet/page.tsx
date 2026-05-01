import Link from "next/link";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";

/**
 * شاشة اختيار القسم على التابلت — قبل إدخال PIN.
 */
export default function TabletPage() {
  const departments = Object.keys(DEPARTMENT_LABELS) as DepartmentCode[];

  return (
    <main className="min-h-screen p-6 bg-slate-100">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">اختر القسم</h1>
          <p className="text-slate-600 mt-2">ستحتاج PIN القسم بعد الاختيار</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <Link
              key={dept}
              href={`/tablet/pin?dept=${dept}`}
              className="card hover:shadow-lg transition-shadow text-center py-10"
            >
              <div className="text-3xl mb-3">🏷️</div>
              <div className="text-xl font-bold text-slate-900">
                {DEPARTMENT_LABELS[dept]}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            ← العودة
          </Link>
        </div>
      </div>
    </main>
  );
}
