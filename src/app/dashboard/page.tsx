import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import {
  INVOICE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TRACK_LABELS,
  formatDepartmentLabel,
  formatLabel,
} from "@/lib/display-labels";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { USER_ROLE_LABELS } from "@/lib/types/database";

const moduleCards: Array<{
  href: string;
  title: string;
  description: string;
  label: string;
  permission?: Permission;
}> = [
  { href: "/dashboard/orders", title: "الطلبات", description: "إنشاء ومتابعة الطلبات والصور والبنود.", label: "تشغيل", permission: "orders.view" },
  { href: "/dashboard/batches", title: "الدفعات", description: "تقسيم الطلبات وتحويلها بين الأقسام.", label: "إنتاج", permission: "batches.view" },
  { href: "/dashboard/inventory", title: "المخزون", description: "الأرصدة والحجوزات وحركات الصرف والوارد.", label: "رصيد", permission: "inventory.view" },
  { href: "/dashboard/archive", title: "الأرشفة", description: "ملفات الطلبات، البحث، والترحيل من الأرشيف.", label: "ملفات", permission: "archive.complete" },
  { href: "/dashboard/finance", title: "المالية", description: "الفواتير والمدفوعات والمتبقي على العملاء.", label: "مال", permission: "finance.view" },
  { href: "/dashboard/reports", title: "التقارير", description: "صفحات مستقلة لكل تقرير تشغيلي.", label: "تحليل", permission: "reports.view" },
];

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  orders: "الطلبات",
  order_items: "بنود الطلب",
  batches: "الدفعات",
  batch_transfers: "تحويلات الدفعات",
  quantity_movements: "حركات الكميات",
  inventory_items: "المخزون",
  inventory_item_variants: "ألوان المخزون",
  inventory_movements: "حركات المخزون",
  invoices: "الفواتير",
  payments: "المدفوعات",
  purchase_requests: "المشتريات",
  quality_records: "الجودة",
  delivery_records: "التسليم",
  order_files: "ملفات الطلبات",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: "إضافة",
  UPDATE: "تحديث",
  DELETE: "حذف",
  insert: "إضافة",
  update: "تحديث",
  delete: "حذف",
};

type InventoryMovementSummary = { movement_type: string; quantity: number };
type InventoryItemRow = {
  id: string;
  name: string;
  unit: string;
  min_quantity: number;
  variants?: Array<{
    id: string;
    color_name: string;
    min_quantity: number | null;
    is_active: boolean;
    inventory_movements?: InventoryMovementSummary[] | null;
  }> | null;
};
type PaymentSummary = { amount: number };

export default async function DashboardHomePage() {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: todayOrderCount },
    { count: activeOrderCount },
    { count: pendingTransferCount },
    { count: openInvoiceCount },
    { data: recentOrders },
    { data: pendingTransfers },
    { data: inventoryItems },
    { data: openInvoices },
    { data: auditLogs },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "in_progress"]),
    supabase
      .from("batch_transfers")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .in("status", ["issued", "partially_paid"]),
    supabase
      .from("orders")
      .select("id, order_number, status, track, due_date, created_at, customer:customers(name), items:order_items(product_type, quantity)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("batch_transfers")
      .select("id, quantity_sent, status, from_department, to_department, sent_at, batch:batches(batch_code, order:orders(order_number))")
      .eq("status", "sent")
      .order("sent_at", { ascending: true })
      .limit(5),
    supabase
      .from("inventory_items")
      .select("id, name, unit, min_quantity, variants:inventory_item_variants(id, color_name, min_quantity, is_active, inventory_movements(movement_type, quantity))")
      .eq("is_active", true)
      .limit(120),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, due_date, total_amount, customer:customers(name), order:orders(order_number), payments(amount)")
      .in("status", ["issued", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, created_at, user:app_users(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const visibleModules = moduleCards.filter(
    (item) => !item.permission || hasPermission(user?.role, item.permission),
  );
  const lowStockRows = buildLowStockRows((inventoryItems ?? []) as InventoryItemRow[]);
  const invoiceRows = (openInvoices ?? []).map((invoice) => {
    const paidAmount = ((invoice.payments ?? []) as PaymentSummary[]).reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const totalAmount = Number(invoice.total_amount ?? 0);

    return {
      ...invoice,
      remainingAmount: Math.max(totalAmount - paidAmount, 0),
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-medium text-brand-600">لوحة التحكم</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">مركز تشغيل المصنع</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {user?.full_name ?? "مستخدم"} · {user ? USER_ROLE_LABELS[user.role] : "دور غير محدد"}. ملخص سريع لما يحتاج متابعة اليوم.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPermission(user?.role, "orders.create") && (
              <Link href="/dashboard/orders" className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">
                طلب جديد
              </Link>
            )}
            <Link href="/dashboard/reports" className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              فتح التقارير
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="طلبات اليوم" value={`${todayOrderCount ?? 0}`} hint={`النشطة: ${activeOrderCount ?? 0}`} />
        <MetricCard label="دفعات معلقة" value={`${pendingTransferCount ?? 0}`} hint="بانتظار استلام قسم" />
        <MetricCard label="مخزون منخفض" value={`${lowStockRows.length}`} hint="ألوان وصلت حد التنبيه" />
        <MetricCard label="فواتير مفتوحة" value={`${openInvoiceCount ?? 0}`} hint="مصدر أو مدفوع جزئيًا" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="يحتاج متابعة" actionHref="/dashboard/reports/overview" actionLabel="تقرير الملخص">
          <div className="grid gap-4 lg:grid-cols-3">
            <AttentionList title="تحويلات معلقة" emptyText="لا توجد تحويلات معلقة.">
              {(pendingTransfers ?? []).map((transfer) => {
                const batch = singleRelation(transfer.batch);
                const order = singleRelation(batch?.order);

                return (
                  <ListRow
                    key={transfer.id}
                    title={batch?.batch_code ?? "دفعة غير محددة"}
                    meta={`${order?.order_number ?? "—"} · ${formatDepartmentLabel(transfer.from_department)} إلى ${formatDepartmentLabel(transfer.to_department)}`}
                    value={`${transfer.quantity_sent}`}
                  />
                );
              })}
            </AttentionList>

            <AttentionList title="مخزون منخفض" emptyText="لا يوجد مخزون منخفض.">
              {lowStockRows.slice(0, 5).map((item) => (
                <ListRow
                  key={item.id}
                  title={item.name}
                  meta={`${item.colorName} · الحد ${formatNumber(item.minQuantity)} ${item.unit}`}
                  value={`${formatNumber(item.availableBalance)}`}
                />
              ))}
            </AttentionList>

            <AttentionList title="فواتير مفتوحة" emptyText="لا توجد فواتير مفتوحة.">
              {invoiceRows.map((invoice) => (
                <ListRow
                  key={invoice.id}
                  title={invoice.invoice_number}
                  meta={`${singleRelation(invoice.customer)?.name ?? "—"} · ${formatLabel(INVOICE_STATUS_LABELS, invoice.status)}`}
                  value={money(invoice.remainingAmount)}
                />
              ))}
            </AttentionList>
          </div>
        </Panel>

        <Panel title="مسارات سريعة" actionHref="/dashboard/reports" actionLabel="كل التقارير">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {visibleModules.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-300 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-brand-700">
                    {item.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="آخر الطلبات" actionHref="/dashboard/orders" actionLabel="كل الطلبات">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-3 font-medium">الطلب</th>
                  <th className="px-3 py-3 font-medium">العميل</th>
                  <th className="px-3 py-3 font-medium">البند</th>
                  <th className="px-3 py-3 font-medium">المسار</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                  <th className="px-3 py-3 font-medium">التسليم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(recentOrders ?? []).map((order) => {
                  const customer = singleRelation(order.customer);
                  const firstItem = order.items?.[0];

                  return (
                    <tr key={order.id}>
                      <td className="px-3 py-3 font-semibold text-brand-600" dir="ltr">
                        <Link href={`/dashboard/orders/${encodeURIComponent(order.order_number)}`} className="hover:underline">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{customer?.name ?? "—"}</td>
                      <td className="px-3 py-3 text-slate-700">{firstItem ? `${firstItem.product_type} - ${firstItem.quantity}` : "—"}</td>
                      <td className="px-3 py-3 text-slate-700">{formatLabel(ORDER_TRACK_LABELS, order.track)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatLabel(ORDER_STATUS_LABELS, order.status)}</td>
                      <td className="px-3 py-3 text-slate-700" dir="ltr">{order.due_date ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="آخر نشاط" actionHref="/dashboard/audit" actionLabel="سجل التدقيق">
          {(auditLogs ?? []).length === 0 ? (
            <EmptyText text="لا توجد أنشطة مسجلة بعد." />
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {(auditLogs ?? []).map((log) => (
                <div key={log.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {formatAuditAction(log.action)} في {formatAuditEntity(log.entity_type)}
                      </div>
                      <div className="mt-1 text-slate-500">
                        {singleRelation(log.user)?.full_name ?? "النظام"} · {formatDateTime(log.created_at)}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500" dir="ltr">
                      {log.entity_id?.slice(0, 8) ?? "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
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

function Panel({
  title,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {actionHref && actionLabel && (
          <Link href={actionHref} className="text-sm font-medium text-brand-600 hover:underline">
            {actionLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function AttentionList({ title, emptyText, children }: { title: string; emptyText: string; children: ReactNode }) {
  const childArray = Array.isArray(children) ? children.filter(Boolean) : children;
  const hasRows = Array.isArray(childArray) ? childArray.length > 0 : Boolean(childArray);

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{title}</div>
      {hasRows ? (
        <div className="divide-y divide-slate-200">{childArray}</div>
      ) : (
        <div className="px-4 py-4 text-sm text-slate-600">{emptyText}</div>
      )}
    </div>
  );
}

function ListRow({ title, meta, value }: { title: string; meta: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-900">{title}</div>
        <div className="mt-1 break-words text-xs leading-5 text-slate-600">{meta}</div>
      </div>
      <div className="shrink-0 text-xs font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{text}</div>;
}

function buildLowStockRows(items: InventoryItemRow[]) {
  return items
    .flatMap((item) =>
      (item.variants ?? [])
        .filter((variant) => variant.is_active)
        .map((variant) => {
          const balance = summarizeInventoryMovements(variant.inventory_movements ?? []);
          const minQuantity = Number(variant.min_quantity ?? item.min_quantity ?? 0);

          return {
            id: variant.id,
            name: item.name,
            colorName: variant.color_name,
            unit: item.unit,
            availableBalance: balance.availableBalance,
            minQuantity,
          };
        }),
    )
    .filter((item) => item.availableBalance <= item.minQuantity)
    .sort((firstItem, secondItem) => firstItem.availableBalance - secondItem.availableBalance);
}

function formatAuditAction(action: string | null | undefined) {
  if (!action) return "نشاط";
  return AUDIT_ACTION_LABELS[action] ?? action;
}

function formatAuditEntity(entityType: string | null | undefined) {
  if (!entityType) return "النظام";
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value);
}

function money(value: number) {
  return `${new Intl.NumberFormat("ar", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ريال`;
}
