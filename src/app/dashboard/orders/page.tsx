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

type OrderRow = {
  id: string;
  order_number: string;
  status: string | null;
  track: string | null;
  due_date: string | null;
  created_at: string | null;
  customer: { name: string } | Array<{ name: string }> | null;
  items?: OrderItemSummary[] | null;
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
  const orderRows = (orders ?? []) as OrderRow[];
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
  const activeOrderCount = orderRows.filter((order) => ["draft", "in_progress"].includes(order.status ?? "")).length;
  const inProgressCount = orderRows.filter((order) => order.status === "in_progress").length;
  const dueSoonCount = orderRows.filter(isDueSoon).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-medium text-brand-600">إدارة الطلبات</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">الطلبات</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              إنشاء الطلب وربط العميل والقماش والصور، ثم متابعة حالته حتى التسليم والأرشفة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate && (
              <Link href="#new-order" className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">
                طلب جديد
              </Link>
            )}
            <Link href="/dashboard/reports/orders" className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              تقرير الطلبات
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="كل الطلبات" value={formatNumber(orderRows.length)} hint="إجمالي الطلبات المسجلة" />
        <MetricCard label="طلبات نشطة" value={formatNumber(activeOrderCount)} hint="مسودة أو قيد التنفيذ" />
        <MetricCard label="قيد التنفيذ" value={formatNumber(inProgressCount)} hint="داخل دورة الإنتاج" />
        <MetricCard label="تسليم قريب" value={formatNumber(dueSoonCount)} hint="خلال 7 أيام" />
      </section>

      <details id="new-order" className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">إنشاء طلب جديد</h2>
            <p className="mt-1 text-sm text-slate-600">بيانات العميل والبند والقماش والصور في نموذج واحد.</p>
          </div>
          <span className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            فتح النموذج
          </span>
        </summary>
        <div className="border-t border-slate-200 p-4">
          <OrderForm
            customers={customers ?? []}
            canCreate={canCreate}
            fabricVariants={fabricVariants}
            className="space-y-4"
          />
        </div>
      </details>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">قائمة الطلبات</h2>
          <span className="text-sm text-slate-500">{formatNumber(orderRows.length)} طلب</span>
        </div>
        {orderRows.length === 0 ? (
          <EmptyText text="لا يوجد طلبات بعد." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-3 font-medium">رقم الطلب</th>
                  <th className="px-3 py-3 font-medium">العميل</th>
                  <th className="px-3 py-3 font-medium">البند</th>
                  <th className="px-3 py-3 font-medium">المقاسات</th>
                  <th className="px-3 py-3 font-medium">المسار</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                  <th className="px-3 py-3 font-medium">التسليم</th>
                  <th className="px-3 py-3 font-medium">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderRows.map((order) => {
                  const customer = singleRelation(order.customer);
                  const firstItem = order.items?.[0] ?? null;
                  return (
                    <tr key={order.id} className="align-top">
                      <td className="px-3 py-3 font-semibold" dir="ltr">
                        <Link
                          href={`/dashboard/orders/${encodeURIComponent(order.order_number)}`}
                          className="text-brand-600 hover:underline"
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{customer?.name ?? "—"}</td>
                      <td className="max-w-[20rem] px-3 py-3 text-slate-700">
                        {firstItem
                          ? `${firstItem.product_type} - ${firstItem.quantity} (${firstItem.fabric ?? "—"} / ${firstItem.color ?? "—"})`
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatSizes(firstItem?.size_breakdown ?? null)}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {formatLabel(ORDER_TRACK_LABELS, order.track)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-3 py-3 text-slate-700" dir="ltr">{order.due_date ?? "—"}</td>
                      <td className="px-3 py-3 text-slate-700" dir="ltr">
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

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const className = status === "cancelled"
    ? "border-red-200 bg-red-50 text-red-700"
    : status === "completed" || status === "archived"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "in_progress"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      {formatLabel(ORDER_STATUS_LABELS, status)}
    </span>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{text}</div>;
}

function isDueSoon(order: OrderRow) {
  if (!order.due_date || ["cancelled", "completed", "archived"].includes(order.status ?? "")) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const dueDate = new Date(`${order.due_date}T00:00:00`);

  return Number.isFinite(dueDate.getTime()) && dueDate >= today && dueDate <= nextWeek;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value);
}
