import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";
import { QUANTITY_MOVEMENT_LABELS, formatLabel } from "@/lib/display-labels";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";
import MovementForm from "./movement-form";

export default async function MovementsPage() {
  const user = await requirePermission("movements.view");
  const supabase = await createSupabaseServerClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number")
    .order("created_at", { ascending: false });

  const { data: batches } = await supabase
    .from("batches")
    .select("id, batch_code")
    .order("created_at", { ascending: false });

  const { data: movements } = await supabase
    .from("quantity_movements")
    .select(
      "id, movement_type, quantity, reason, department, created_at, order:orders(order_number), batch:batches(batch_code)",
    )
    .order("created_at", { ascending: false });

  const canCreate = hasPermission(user.role, "movements.create");

  const orderOptions = (orders ?? []).map((order) => ({
    id: order.id as string,
    order_number: order.order_number,
  }));

  const batchOptions = (batches ?? []).map((batch) => ({
    id: batch.id as string,
    batch_code: batch.batch_code,
  }));

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">حركات الكميات</h1>
        <p className="mt-2 text-slate-600">
          أي فرق يصبح حركة كمية رسمية منسوبة لقسم وشخص.
        </p>
      </header>

      <MovementForm orders={orderOptions} batches={batchOptions} canCreate={canCreate} />

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">آخر الحركات</h2>
        {!movements || movements.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد حركات بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">الدفعة</th>
                  <th className="py-2 px-3">القسم</th>
                  <th className="py-2 px-3">النوع</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">السبب</th>
                  <th className="py-2 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.map((movement) => {
                  const order = singleRelation(movement.order);
                  const batch = singleRelation(movement.batch);
                  const department = movement.department as DepartmentCode | null;
                  return (
                    <tr key={movement.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {order?.order_number ?? "—"}
                      </td>
                      <td className="py-2 px-3">{batch?.batch_code ?? "—"}</td>
                      <td className="py-2 px-3">
                        {department ? DEPARTMENT_LABELS[department] : "—"}
                      </td>
                      <td className="py-2 px-3">{formatLabel(QUANTITY_MOVEMENT_LABELS, movement.movement_type)}</td>
                      <td className="py-2 px-3">{movement.quantity}</td>
                      <td className="py-2 px-3">{movement.reason}</td>
                      <td className="py-2 px-3" dir="ltr">
                        {movement.created_at?.slice(0, 10) ?? "—"}
                      </td>
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
