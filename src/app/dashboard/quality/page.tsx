import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import QualityForm from "./quality-form";

const RESULT_LABELS: Record<string, string> = {
  passed: "ناجح",
  failed: "مرفوض",
  rework: "إعادة عمل",
};

type BatchRelation = { batch_code: string };
type OrderRelation = { order_number: string };
type UserRelation = { full_name: string };

export default async function QualityPage() {
  const user = await requirePermission("quality.view");
  const supabase = await createSupabaseServerClient();

  const [{ data: batches }, { data: records }] = await Promise.all([
    supabase
      .from("batches")
      .select("id, batch_code, quantity, status, order:orders(order_number)")
      .eq("current_department", "quality")
      .neq("status", "closed")
      .order("updated_at", { ascending: false }),
    supabase
      .from("quality_records")
      .select("id, result, checked_quantity, failed_quantity, notes, created_at, batch:batches(batch_code), order:orders(order_number), checker:app_users(full_name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const batchOptions = (batches ?? []).map((batch) => ({
    id: batch.id as string,
    batch_code: batch.batch_code,
    order_number: singleRelation(batch.order as OrderRelation | OrderRelation[] | null)?.order_number ?? "—",
    quantity: Number(batch.quantity),
  }));

  const canRecord = hasPermission(user.role, "quality.record");

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">الجودة</h1>
        <p className="mt-2 text-slate-600">توثيق قبول الدفعات أو رفضها قبل انتقالها إلى التغليف.</p>
      </header>

      <QualityForm batches={batchOptions} canRecord={canRecord} />

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">دفعات بانتظار الجودة</h2>
        {batchOptions.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد دفعات في الجودة حاليًا.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الدفعة</th>
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">الكمية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batchOptions.map((batch) => (
                  <tr key={batch.id}>
                    <td className="py-2 px-3 font-medium text-slate-900" dir="ltr">{batch.batch_code}</td>
                    <td className="py-2 px-3">{batch.order_number}</td>
                    <td className="py-2 px-3">{batch.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">آخر سجلات الجودة</h2>
        {!records || records.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد سجلات جودة بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الدفعة</th>
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">النتيجة</th>
                  <th className="py-2 px-3">المفحوص</th>
                  <th className="py-2 px-3">المرفوض</th>
                  <th className="py-2 px-3">الفاحص</th>
                  <th className="py-2 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.map((record) => {
                  const batch = singleRelation(record.batch as BatchRelation | BatchRelation[] | null);
                  const order = singleRelation(record.order as OrderRelation | OrderRelation[] | null);
                  const checker = singleRelation(record.checker as UserRelation | UserRelation[] | null);

                  return (
                    <tr key={record.id}>
                      <td className="py-2 px-3 font-medium text-slate-900" dir="ltr">{batch?.batch_code ?? "—"}</td>
                      <td className="py-2 px-3">{order?.order_number ?? "—"}</td>
                      <td className="py-2 px-3">{RESULT_LABELS[record.result] ?? record.result}</td>
                      <td className="py-2 px-3">{record.checked_quantity}</td>
                      <td className="py-2 px-3">{record.failed_quantity}</td>
                      <td className="py-2 px-3">{checker?.full_name ?? "—"}</td>
                      <td className="py-2 px-3" dir="ltr">{record.created_at?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}