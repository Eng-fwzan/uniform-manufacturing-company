import Link from "next/link";
import { redirect } from "next/navigation";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";
import PinPad from "./pin-pad";

/**
 * شاشة إدخال PIN للقسم على التابلت.
 * مرجع: docs/plan/system-master-plan-ar.md §3.2 + §4 Phase 0
 */
export default async function PinPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const params = await searchParams;
  const dept = params.dept as DepartmentCode | undefined;

  if (!dept || !(dept in DEPARTMENT_LABELS)) {
    redirect("/tablet");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-6">
            <div className="text-sm text-slate-600">القسم</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {DEPARTMENT_LABELS[dept]}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              أدخل PIN الخاص بك (4-6 أرقام)
            </div>
          </div>

          <PinPad department={dept} />

          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link href="/" className="text-brand-600 hover:underline">
              بوابة الدخول
            </Link>
            <Link href="/tablet" className="text-slate-500 hover:underline">
              ← تغيير القسم
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
