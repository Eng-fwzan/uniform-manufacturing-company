import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";
import { ORDER_STATUS_LABELS, ORDER_TRACK_LABELS, formatLabel } from "@/lib/display-labels";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";
import OrderForm from "./order-form";

type OrderItemSummary = {
  product_type: string;
  quantity: number;
  fabric: string | null;
  color: string | null;
  size_breakdown: Record<string, unknown> | null;
};

type InventoryMovementSummary = { movement_type: string; quantity: number };

type FabricInventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  variants?: Array<{
    id: string;
    color_name: string;
    is_active: boolean;
    inventory_movements?: InventoryMovementSummary[];
  }>;
};

function formatSizes(sizeBreakdown: Record<string, unknown> | null) {
  if (!sizeBreakdown) return "—";

  const standardSizes = ["S", "M", "L", "XL"]
    .map((size) => `${size}: ${Number(sizeBreakdown[size] ?? 0)}`)
    .join(" / ");
  const custom = typeof sizeBreakdown.custom === "string" && sizeBreakdown.custom.trim()
    ? ` / ${sizeBreakdown.custom.trim()}`
    : "";

  return `${standardSizes}${custom}`;
}

export default async function OrdersPage() {
  const user = await requirePermission("orders.view");
  const supabase = await createSupabaseServerClient();

  const [{ data: customers }, { data: orders }, { data: fabricItems }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("orders")
      .select("id, order_number, status, track, due_date, created_at, customer:customers(name), items:order_items(product_type, quantity, fabric, color, size_breakdown)")
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, category, unit, variants:inventory_item_variants(id, color_name, is_active, inventory_movements(movement_type, quantity))")
      .eq("is_active", true)
      .eq("category", "fabric")
      .order("created_at", { ascending: false }),
  ]);

  const canCreate = hasPermission(user.role, "orders.create");
  const fabricVariants = ((fabricItems ?? []) as FabricInventoryItem[]).flatMap((item) =>
    (item.variants ?? [])
      .filter((variant) => variant.is_active)
      .map((variant) => ({
        id: variant.id,
        name: item.name,
        color_name: variant.color_name,
        unit: item.unit,
        balance: summarizeInventoryMovements(variant.inventory_movements ?? []).availableBalance,
      }))
      .filter((variant) => variant.balance > 0),
  );

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">الطلبات</h1>
        <p className="mt-2 text-slate-600">
          شاشة إنشاء ومتابعة الطلبات نقطة البداية لإيقاف الدفاتر الورقية.
        </p>
      </header>

      <OrderForm customers={customers ?? []} canCreate={canCreate} fabricVariants={fabricVariants} />

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">آخر الطلبات</h2>
        {!orders || orders.length === 0 ? (
          <div className="text-sm text-slate-600">لا يوجد طلبات بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">رقم الطلب</th>
                  <th className="py-2 px-3">العميل</th>
                  <th className="py-2 px-3">البند</th>
                  <th className="py-2 px-3">المقاسات</th>
                  <th className="py-2 px-3">المسار</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">التسليم</th>
                  <th className="py-2 px-3">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((order) => {
                  const customer = singleRelation(order.customer);
                  const firstItem = (order.items?.[0] ?? null) as OrderItemSummary | null;
                  return (
                    <tr key={order.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        <Link
                          href={`/dashboard/orders/${encodeURIComponent(order.order_number)}`}
                          className="text-brand-600 hover:underline"
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="py-2 px-3">{customer?.name ?? "—"}</td>
                      <td className="py-2 px-3">
                        {firstItem
                          ? `${firstItem.product_type} - ${firstItem.quantity} (${firstItem.fabric ?? "—"} / ${firstItem.color ?? "—"})`
                          : "—"}
                      </td>
                      <td className="py-2 px-3">{formatSizes(firstItem?.size_breakdown ?? null)}</td>
                      <td className="py-2 px-3">
                        {formatLabel(ORDER_TRACK_LABELS, order.track)}
                      </td>
                      <td className="py-2 px-3">{formatLabel(ORDER_STATUS_LABELS, order.status)}</td>
                      <td className="py-2 px-3">{order.due_date ?? "—"}</td>
                      <td className="py-2 px-3" dir="ltr">
                        {order.created_at?.slice(0, 10) ?? "—"}
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