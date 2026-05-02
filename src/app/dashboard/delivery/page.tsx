import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DeliveryForm from "./delivery-form";

type BatchRelation = { batch_code: string };
type OrderRelation = { order_number: string };
type UserRelation = { full_name: string };

export default async function DeliveryPage() {
  const user = await requirePermission("delivery.view");
  const supabase = await createSupabaseServerClient();

  const [{ data: batches }, { data: deliveries }] = await Promise.all([
    supabase
      .from("batches")
      .select("id, batch_code, quantity, status, order:orders(order_number)")
      .eq("current_department", "delivery")
      .neq("status", "closed")
      .order("updated_at", { ascending: false }),
    supabase
      .from("delivery_records")
      .select("id, delivered_quantity, recipient_name, recipient_phone, notes, delivered_at, batch:batches(batch_code), order:orders(order_number), deliverer:app_users(full_name)")
      .order("delivered_at", { ascending: false })
      .limit(50),
  ]);

  const batchOptions = (batches ?? []).map((batch) => ({
    id: batch.id as string,
    batch_code: batch.batch_code,
    order_number: singleRelation(batch.order as OrderRelation | OrderRelation[] | null)?.order_number ?? "—",
    quantity: Number(batch.quantity),
  }));

  const canDeliver = hasPermission(user.role, "delivery.create");

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">التسليم</h1>
        <p className="mt-2 text-slate-600">تسجيل المستلم والكمية ثم إغلاق الدفعة رسميًا.</p>
      </header>

      <DeliveryForm batches={batchOptions} canDeliver={canDeliver} />

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">دفعات جاهزة للتسليم</h2>
        {batchOptions.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد دفعات في التسليم حاليًا.</div>
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
        <h2 className="text-lg font-semibold text-slate-900 mb-4">آخر سجلات التسليم</h2>
        {!deliveries || deliveries.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد سجلات تسليم بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الدفعة</th>
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">المستلم</th>
                  <th className="py-2 px-3">المسجل</th>
                  <th className="py-2 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {deliveries.map((delivery) => {
                  const batch = singleRelation(delivery.batch as BatchRelation | BatchRelation[] | null);
                  const order = singleRelation(delivery.order as OrderRelation | OrderRelation[] | null);
                  const deliverer = singleRelation(delivery.deliverer as UserRelation | UserRelation[] | null);

                  return (
                    <tr key={delivery.id}>
                      <td className="py-2 px-3 font-medium text-slate-900" dir="ltr">{batch?.batch_code ?? "—"}</td>
                      <td className="py-2 px-3">{order?.order_number ?? "—"}</td>
                      <td className="py-2 px-3">{delivery.delivered_quantity}</td>
                      <td className="py-2 px-3">{delivery.recipient_name}</td>
                      <td className="py-2 px-3">{deliverer?.full_name ?? "—"}</td>
                      <td className="py-2 px-3" dir="ltr">{delivery.delivered_at?.slice(0, 16).replace("T", " ") ?? "—"}</td>
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