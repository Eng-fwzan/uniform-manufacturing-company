import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";
import {
  BATCH_STATUS_LABELS,
  QUANTITY_MOVEMENT_LABELS,
  TRANSFER_STATUS_LABELS,
  formatDepartmentLabel,
  formatLabel,
} from "@/lib/display-labels";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  if (!(department in DEPARTMENT_LABELS)) {
    redirect("/dashboard/departments");
  }

  const dept = department as DepartmentCode;
  const user = await requirePermission("batches.view");
  const supabase = await createSupabaseServerClient();

  const { data: batches } = await supabase
    .from("batches")
    .select("id, batch_code, quantity, status, order:orders(order_number)")
    .eq("current_department", dept)
    .order("created_at", { ascending: false });

  const { data: transfers } = await supabase
    .from("batch_transfers")
    .select("id, quantity_sent, status, from_department, to_department, sent_at, batch:batches(batch_code)")
    .eq("to_department", dept)
    .order("sent_at", { ascending: false })
    .limit(20);

  const canViewMovements = hasPermission(user.role, "movements.view");
  const { data: movements } = canViewMovements
    ? await supabase
        .from("quantity_movements")
        .select("id, movement_type, quantity, reason, created_at, order:orders(order_number), batch:batches(batch_code)")
        .eq("department", dept)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: null };

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header className="space-y-2">
        <div className="text-sm text-slate-500">قسم الإنتاج</div>
        <h1 className="text-3xl font-bold text-slate-900">{DEPARTMENT_LABELS[dept]}</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/batches" className="text-brand-600 hover:underline">
            إدارة الدفعات
          </Link>
          <Link href="/dashboard/movements" className="text-brand-600 hover:underline">
            حركات الكميات
          </Link>
          <Link href="/dashboard/departments" className="text-slate-500 hover:underline">
            جميع الأقسام
          </Link>
        </div>
      </header>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">دفعات القسم الحالية</h2>
        {!batches || batches.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد دفعات في هذا القسم حاليًا.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الدفعة</th>
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batches.map((batch) => {
                  const order = singleRelation(batch.order);
                  return (
                    <tr key={batch.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">{batch.batch_code}</td>
                      <td className="py-2 px-3">{order?.order_number ?? "—"}</td>
                      <td className="py-2 px-3">{batch.quantity}</td>
                      <td className="py-2 px-3">{formatLabel(BATCH_STATUS_LABELS, batch.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">آخر التحويلات إلى القسم</h2>
        {!transfers || transfers.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد تحويلات حديثة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الدفعة</th>
                  <th className="py-2 px-3">من</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transfers.map((transfer) => {
                  const batch = singleRelation(transfer.batch);
                  return (
                    <tr key={transfer.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {batch?.batch_code ?? "—"}
                      </td>
                      <td className="py-2 px-3">{formatDepartmentLabel(transfer.from_department)}</td>
                      <td className="py-2 px-3">{transfer.quantity_sent}</td>
                      <td className="py-2 px-3">{formatLabel(TRANSFER_STATUS_LABELS, transfer.status)}</td>
                      <td className="py-2 px-3" dir="ltr">
                        {transfer.sent_at?.slice(0, 10) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canViewMovements && (
        <section className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">حركات الكميات في القسم</h2>
          {!movements || movements.length === 0 ? (
            <div className="text-sm text-slate-600">لا توجد حركات بعد.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-500">
                  <tr className="text-right">
                    <th className="py-2 px-3">الطلب</th>
                    <th className="py-2 px-3">الدفعة</th>
                    <th className="py-2 px-3">النوع</th>
                    <th className="py-2 px-3">الكمية</th>
                    <th className="py-2 px-3">السبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {movements.map((movement) => {
                    const order = singleRelation(movement.order);
                    const batch = singleRelation(movement.batch);
                    return (
                      <tr key={movement.id}>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {order?.order_number ?? "—"}
                        </td>
                        <td className="py-2 px-3">{batch?.batch_code ?? "—"}</td>
                        <td className="py-2 px-3">
                          {formatLabel(QUANTITY_MOVEMENT_LABELS, movement.movement_type)}
                        </td>
                        <td className="py-2 px-3">{movement.quantity}</td>
                        <td className="py-2 px-3">{movement.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
