import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";
import { QUANTITY_MOVEMENT_LABELS, formatLabel } from "@/lib/display-labels";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";
import MovementForm from "./movement-form";

type OrderRow = {
  id: string;
  order_number: string;
};

type BatchRow = {
  id: string;
  batch_code: string;
};

type MovementRow = {
  id: string;
  movement_type: string | null;
  quantity: number;
  reason: string | null;
  department: DepartmentCode | null;
  created_at: string | null;
  order: { order_number: string } | Array<{ order_number: string }> | null;
  batch: { batch_code: string } | Array<{ batch_code: string }> | null;
};

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
  const orderRows = (orders ?? []) as OrderRow[];
  const batchRows = (batches ?? []) as BatchRow[];
  const movementRows = (movements ?? []) as MovementRow[];

  const orderOptions = orderRows.map((order) => ({
    id: order.id as string,
    order_number: order.order_number,
  }));

  const batchOptions = batchRows.map((batch) => ({
    id: batch.id as string,
    batch_code: batch.batch_code,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const todayMovementCount = movementRows.filter((movement) => movement.created_at?.startsWith(today)).length;
  const lossMovementCount = movementRows.filter((movement) => ["shortage", "damaged", "waste"].includes(movement.movement_type ?? "")).length;
  const reworkCount = movementRows.filter((movement) => movement.movement_type === "rework").length;
  const totalQuantity = movementRows.reduce((sum, movement) => sum + Number(movement.quantity ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-medium text-brand-600">رقابة الكميات</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">حركات الكميات</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              تسجيل أي فرق في الإنتاج كحركة رسمية مرتبطة بالطلب والدفعة والقسم المسؤول.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate && (
              <Link href="#new-movement" className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">
                حركة جديدة
              </Link>
            )}
            <Link href="/dashboard/reports/transfers" className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              تقرير الحركات
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="كل الحركات" value={formatNumber(movementRows.length)} hint="إجمالي الفروقات المسجلة" />
        <MetricCard label="حركات اليوم" value={formatNumber(todayMovementCount)} hint="ما تم تسجيله اليوم" />
        <MetricCard label="نقص وتالف" value={formatNumber(lossMovementCount)} hint="نقص أو تالف أو هدر" />
        <MetricCard label="إجمالي الكمية" value={formatNumber(totalQuantity)} hint="مجموع كميات الحركات" />
      </section>

      <details id="new-movement" className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">تسجيل حركة كمية</h2>
            <p className="mt-1 text-sm text-slate-600">حدد الطلب والدفعة والقسم ونوع الفرق قبل حفظ الحركة.</p>
          </div>
          <span className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            فتح النموذج
          </span>
        </summary>
        <div className="border-t border-slate-200 p-4">
          <MovementForm orders={orderOptions} batches={batchOptions} canCreate={canCreate} className="space-y-4" />
        </div>
      </details>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">آخر الحركات</h2>
          <div className="flex flex-wrap gap-2 text-sm text-slate-500">
            <span>{formatNumber(movementRows.length)} حركة</span>
            <span>·</span>
            <span>{formatNumber(reworkCount)} إعادة عمل</span>
          </div>
        </div>
        {movementRows.length === 0 ? (
          <EmptyText text="لا توجد حركات بعد." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-3 font-medium">الطلب</th>
                  <th className="px-3 py-3 font-medium">الدفعة</th>
                  <th className="px-3 py-3 font-medium">القسم</th>
                  <th className="px-3 py-3 font-medium">النوع</th>
                  <th className="px-3 py-3 font-medium">الكمية</th>
                  <th className="px-3 py-3 font-medium">السبب</th>
                  <th className="px-3 py-3 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movementRows.map((movement) => {
                  const order = singleRelation(movement.order);
                  const batch = singleRelation(movement.batch);
                  const department = movement.department as DepartmentCode | null;
                  return (
                    <tr key={movement.id} className="align-top">
                      <td className="px-3 py-3 font-semibold text-slate-900" dir="ltr">
                        {order?.order_number ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-700" dir="ltr">{batch?.batch_code ?? "—"}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {department ? DEPARTMENT_LABELS[department] : "—"}
                      </td>
                      <td className="px-3 py-3"><MovementTypeBadge type={movement.movement_type} /></td>
                      <td className="px-3 py-3 text-slate-700">{formatNumber(Number(movement.quantity))}</td>
                      <td className="max-w-[24rem] px-3 py-3 text-slate-700">{movement.reason}</td>
                      <td className="px-3 py-3 text-slate-700" dir="ltr">
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

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function MovementTypeBadge({ type }: { type: string | null }) {
  const className = type === "extra_cut"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : type === "shortage" || type === "damaged" || type === "waste"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "rework"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      {formatLabel(QUANTITY_MOVEMENT_LABELS, type)}
    </span>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{text}</div>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value);
}
