import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";
import {
  BATCH_STATUS_LABELS,
  TRANSFER_STATUS_LABELS,
  formatDepartmentLabel,
  formatLabel,
} from "@/lib/display-labels";
import BatchForm from "./batch-form";
import TransferForm from "./transfer-form";

export default async function BatchesPage() {
  const user = await requirePermission("batches.view");
  const supabase = await createSupabaseServerClient();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_type, quantity, order:orders(order_number, status)")
    .order("created_at", { ascending: false });

  const { data: batches } = await supabase
    .from("batches")
    .select("id, batch_code, status, quantity, current_department, order_item_id, order:orders(order_number)")
    .order("created_at", { ascending: false });

  const { data: transfers } = await supabase
    .from("batch_transfers")
    .select("id, quantity_sent, status, from_department, to_department, batch:batches(batch_code)")
    .order("sent_at", { ascending: false });

  const canCreate = hasPermission(user.role, "batches.create");
  const canTransfer = hasPermission(user.role, "batches.transfer");

  const batchedQuantityByItem = new Map<string, number>();
  for (const batch of batches ?? []) {
    if (!batch.order_item_id) continue;
    batchedQuantityByItem.set(
      batch.order_item_id,
      (batchedQuantityByItem.get(batch.order_item_id) ?? 0) + Number(batch.quantity),
    );
  }

  const itemOptions = (items ?? [])
    .filter((item) => {
      const order = singleRelation(item.order);
      return order && !["cancelled", "completed", "archived"].includes(order.status);
    })
    .map((item) => {
      const originalQuantity = Number(item.quantity);
      const batchedQuantity = batchedQuantityByItem.get(item.id as string) ?? 0;

      return {
        id: item.id as string,
        order_number: singleRelation(item.order)?.order_number ?? "—",
        product_type: item.product_type,
        quantity: originalQuantity,
        batchedQuantity,
        remainingQuantity: Math.max(originalQuantity - batchedQuantity, 0),
      };
    })
    .filter((item) => item.remainingQuantity > 0);

  const batchOptions = (batches ?? [])
    .filter((batch) => !["closed", "in_transit"].includes(batch.status))
    .map((batch) => ({
      id: batch.id as string,
      batch_code: batch.batch_code,
      order_number: singleRelation(batch.order)?.order_number ?? "—",
      quantity: Number(batch.quantity),
      current_department: batch.current_department,
      status: batch.status,
    }));

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">الدفعات</h1>
        <p className="mt-2 text-slate-600">
          إدارة الدفعات وكود B-YYYY-XXXXXX وقائمة دفعات اليوم لأرض المصنع.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <BatchForm items={itemOptions} canCreate={canCreate} />
        <TransferForm batches={batchOptions} canTransfer={canTransfer} />
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">قائمة الدفعات</h2>
        {!batches || batches.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد دفعات بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الكود</th>
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">القسم الحالي</th>
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
                      <td className="py-2 px-3">{formatDepartmentLabel(batch.current_department)}</td>
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
        <h2 className="text-lg font-semibold text-slate-900 mb-4">آخر التحويلات</h2>
        {!transfers || transfers.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد تحويلات بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الدفعة</th>
                  <th className="py-2 px-3">من</th>
                  <th className="py-2 px-3">إلى</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">الحالة</th>
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
                      <td className="py-2 px-3">{formatDepartmentLabel(transfer.to_department)}</td>
                      <td className="py-2 px-3">{transfer.quantity_sent}</td>
                      <td className="py-2 px-3">{formatLabel(TRANSFER_STATUS_LABELS, transfer.status)}</td>
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