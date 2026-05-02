import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import {
  BATCH_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  QUANTITY_MOVEMENT_LABELS,
  formatDepartmentLabel,
  formatLabel,
} from "@/lib/display-labels";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { USER_ROLE_LABELS } from "@/lib/types/database";

const moduleCards: Array<{
  href: string;
  title: string;
  description: string;
  icon: string;
  permission?: Permission;
}> = [
  { href: "/dashboard/orders", title: "الطلبات", description: "إنشاء الطلب وربط القماش والصور والتفاصيل.", icon: "📋", permission: "orders.view" },
  { href: "/dashboard/batches", title: "الدفعات", description: "إنشاء الدفعات وتحويلها بين الأقسام.", icon: "📦", permission: "batches.view" },
  { href: "/dashboard/departments", title: "الأقسام", description: "عرض حالة القص والخياطة والتطريز والجودة.", icon: "🎯", permission: "batches.view" },
  { href: "/dashboard/inventory", title: "المخزون", description: "الأقمشة والألوان والحجوزات والحركات.", icon: "🏭", permission: "inventory.view" },
  { href: "/dashboard/archive", title: "الأرشفة", description: "البحث، الملفات، الإغلاق، وترحيل طلب سابق.", icon: "🗂️", permission: "archive.complete" },
  { href: "/dashboard/reports", title: "التقارير", description: "قوائم تشغيلية مجمعة من بيانات النظام.", icon: "📊", permission: "reports.view" },
];

export default async function DashboardHomePage() {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: activeOrderCount },
    { count: openBatchCount },
    { count: pendingTransferCount },
    { count: todayMovementCount },
    { data: recentOrders },
    { data: recentBatches },
    { data: recentMovements },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "in_progress"]),
    supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed"),
    supabase
      .from("batch_transfers")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("quantity_movements")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("orders")
      .select("id, order_number, status, track, due_date, created_at, customer:customers(name), items:order_items(product_type, quantity)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("batches")
      .select("id, batch_code, status, current_department, quantity, order:orders(order_number)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("quantity_movements")
      .select("id, movement_type, quantity, department, reason, order:orders(order_number), batch:batches(batch_code)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const visibleModules = moduleCards.filter(
    (item) => !item.permission || hasPermission(user?.role, item.permission),
  );

  return (
    <div className="mx-auto max-w-7xl p-8 space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-medium text-brand-600">لوحة التحكم</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">مرحبًا، {user?.full_name}</h1>
          <p className="mt-2 text-slate-600">
            {user ? USER_ROLE_LABELS[user.role] : "مستخدم"} · مركز تشغيل المصنع والطلبات والدفعات.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {hasPermission(user?.role, "orders.create") && (
            <Link href="/dashboard/orders" className="btn-tablet btn-primary text-base">
              طلب جديد
            </Link>
          )}
          <Link href="/tablet" className="btn-tablet btn-secondary text-base">
            واجهة التابلت
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="طلبات نشطة" value={`${activeOrderCount ?? 0}`} hint="مسودة أو قيد التنفيذ" />
        <MetricCard label="دفعات مفتوحة" value={`${openBatchCount ?? 0}`} hint="لم تغلق بعد" />
        <MetricCard label="تحويلات معلقة" value={`${pendingTransferCount ?? 0}`} hint="بانتظار استلام" />
        <MetricCard label="حركات اليوم" value={`${todayMovementCount ?? 0}`} hint="فروقات كمية مسجلة" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">آخر الطلبات</h2>
            <Link href="/dashboard/orders" className="text-sm text-brand-600 hover:underline">كل الطلبات</Link>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-3 font-medium">الطلب</th>
                  <th className="px-3 py-3 font-medium">العميل</th>
                  <th className="px-3 py-3 font-medium">البند</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                  <th className="px-3 py-3 font-medium">التسليم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(recentOrders ?? []).map((order) => {
                  const customer = singleRelation(order.customer);
                  const item = order.items?.[0];
                  return (
                    <tr key={order.id}>
                      <td className="px-3 py-3 font-semibold text-brand-600" dir="ltr">
                        <Link href={`/dashboard/orders/${encodeURIComponent(order.order_number)}`} className="hover:underline">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{customer?.name ?? "—"}</td>
                      <td className="px-3 py-3 text-slate-700">{item ? `${item.product_type} - ${item.quantity}` : "—"}</td>
                      <td className="px-3 py-3 text-slate-700">{formatLabel(ORDER_STATUS_LABELS, order.status)}</td>
                      <td className="px-3 py-3 text-slate-700" dir="ltr">{order.due_date ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">شاشات سريعة</h2>
          <div className="space-y-3">
            {visibleModules.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 hover:border-brand-300 hover:bg-white">
                <div className="flex items-center gap-3">
                  <span>{item.icon}</span>
                  <span className="font-semibold text-slate-900">{item.title}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">{item.description}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ActivityCard title="آخر الدفعات" href="/dashboard/batches">
          {(recentBatches ?? []).length === 0 ? (
            <EmptyText text="لا توجد دفعات بعد." />
          ) : (
            <div className="space-y-3">
              {(recentBatches ?? []).map((batch) => (
                <div key={batch.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900" dir="ltr">{batch.batch_code}</span>
                    <span className="text-slate-600">{formatLabel(BATCH_STATUS_LABELS, batch.status)}</span>
                  </div>
                  <div className="mt-1 text-slate-600">
                    {singleRelation(batch.order)?.order_number ?? "—"} · {formatDepartmentLabel(batch.current_department)} · {batch.quantity} قطعة
                  </div>
                </div>
              ))}
            </div>
          )}
        </ActivityCard>

        <ActivityCard title="آخر حركات الكميات" href="/dashboard/movements">
          {(recentMovements ?? []).length === 0 ? (
            <EmptyText text="لا توجد حركات كمية بعد." />
          ) : (
            <div className="space-y-3">
              {(recentMovements ?? []).map((movement) => (
                <div key={movement.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">{formatLabel(QUANTITY_MOVEMENT_LABELS, movement.movement_type)}</span>
                    <span className="text-slate-600">{movement.quantity}</span>
                  </div>
                  <div className="mt-1 text-slate-600">
                    {singleRelation(movement.order)?.order_number ?? "—"} · {formatDepartmentLabel(movement.department)} · {movement.reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ActivityCard>
      </section>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function ActivityCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <Link href={href} className="text-sm text-brand-600 hover:underline">فتح</Link>
      </div>
      {children}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{text}</div>;
}