import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";
import type { DepartmentCode } from "@/lib/types/database";
import {
  BATCH_STATUS_LABELS,
  TRANSFER_STATUS_LABELS,
  formatDepartmentLabel,
  formatLabel,
} from "@/lib/display-labels";
import BatchForm from "./batch-form";
import TransferForm from "./transfer-form";

type OrderItemRow = {
  id: string;
  product_type: string;
  quantity: number;
  order: { order_number: string; status: string | null } | Array<{ order_number: string; status: string | null }> | null;
};

type BatchRow = {
  id: string;
  batch_code: string;
  status: string | null;
  quantity: number;
  current_department: DepartmentCode | null;
  order_item_id: string | null;
  order: { order_number: string } | Array<{ order_number: string }> | null;
};

type TransferRow = {
  id: string;
  quantity_sent: number;
  status: string | null;
  from_department: DepartmentCode | null;
  to_department: DepartmentCode | null;
  batch: { batch_code: string } | Array<{ batch_code: string }> | null;
};

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
  const itemRows = (items ?? []) as OrderItemRow[];
  const batchRows = (batches ?? []) as BatchRow[];
  const transferRows = (transfers ?? []) as TransferRow[];

  const batchedQuantityByItem = new Map<string, number>();
  for (const batch of batchRows) {
    if (!batch.order_item_id) continue;
    batchedQuantityByItem.set(
      batch.order_item_id,
      (batchedQuantityByItem.get(batch.order_item_id) ?? 0) + Number(batch.quantity),
    );
  }

  const itemOptions = itemRows
    .filter((item) => {
      const order = singleRelation(item.order);
      return order && !["cancelled", "completed", "archived"].includes(order.status ?? "");
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

  const batchOptions = batchRows
    .filter((batch) => !["closed", "in_transit"].includes(batch.status ?? ""))
    .map((batch) => ({
      id: batch.id as string,
      batch_code: batch.batch_code,
      order_number: singleRelation(batch.order)?.order_number ?? "—",
      quantity: Number(batch.quantity),
      current_department: batch.current_department,
      status: batch.status ?? "open",
    }));

  const activeBatchCount = batchRows.filter((batch) => batch.status !== "closed").length;
  const inTransitCount = batchRows.filter((batch) => batch.status === "in_transit").length;
  const pendingTransferCount = transferRows.filter((transfer) => transfer.status === "sent").length;
  const totalQuantity = batchRows.reduce((sum, batch) => sum + Number(batch.quantity ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-medium text-brand-600">إدارة الإنتاج</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">الدفعات</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              إنشاء دفعات من بنود الطلبات، ثم تحويلها بين الأقسام ومتابعة موقعها الحالي في المصنع.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate && (
              <Link href="#create-batch" className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">
                دفعة جديدة
              </Link>
            )}
            {canTransfer && (
              <Link href="#transfer-batch" className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                تحويل دفعة
              </Link>
            )}
            <Link href="/dashboard/reports/batches" className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              تقرير الدفعات
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="كل الدفعات" value={formatNumber(batchRows.length)} hint="إجمالي دفعات الإنتاج" />
        <MetricCard label="دفعات نشطة" value={formatNumber(activeBatchCount)} hint="ليست مغلقة بعد" />
        <MetricCard label="جاهزة للتحويل" value={formatNumber(batchOptions.length)} hint="مفتوحة أو مستلمة" />
        <MetricCard label="كمية الدفعات" value={formatNumber(totalQuantity)} hint="مجموع الكميات المسجلة" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <details id="create-batch" className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">إنشاء دفعة جديدة</h2>
              <p className="mt-1 text-sm text-slate-600">اختر بند الطلب والكمية والقسم الذي ستبدأ منه الدفعة.</p>
            </div>
            <span className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              فتح النموذج
            </span>
          </summary>
          <div className="border-t border-slate-200 p-4">
            <BatchForm items={itemOptions} canCreate={canCreate} className="space-y-4" />
          </div>
        </details>

        <details id="transfer-batch" className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">تحويل دفعة</h2>
              <p className="mt-1 text-sm text-slate-600">إرسال الدفعة من قسمها الحالي إلى القسم التالي في خط الإنتاج.</p>
            </div>
            <span className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              فتح النموذج
            </span>
          </summary>
          <div className="border-t border-slate-200 p-4">
            <TransferForm batches={batchOptions} canTransfer={canTransfer} className="space-y-4" />
          </div>
        </details>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">قائمة الدفعات</h2>
          <span className="text-sm text-slate-500">{formatNumber(batchRows.length)} دفعة</span>
        </div>
        {batchRows.length === 0 ? (
          <EmptyText text="لا توجد دفعات بعد." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-3 font-medium">الكود</th>
                  <th className="px-3 py-3 font-medium">الطلب</th>
                  <th className="px-3 py-3 font-medium">الكمية</th>
                  <th className="px-3 py-3 font-medium">القسم الحالي</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchRows.map((batch) => {
                  const order = singleRelation(batch.order);
                  return (
                    <tr key={batch.id} className="align-top">
                      <td className="px-3 py-3 font-semibold text-brand-600" dir="ltr">{batch.batch_code}</td>
                      <td className="px-3 py-3 text-slate-700" dir="ltr">{order?.order_number ?? "—"}</td>
                      <td className="px-3 py-3 text-slate-700">{formatNumber(Number(batch.quantity))}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDepartmentLabel(batch.current_department)}</td>
                      <td className="px-3 py-3"><BatchStatusBadge status={batch.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">آخر التحويلات</h2>
          <div className="flex flex-wrap gap-2 text-sm text-slate-500">
            <span>{formatNumber(transferRows.length)} تحويل</span>
            <span>·</span>
            <span>{formatNumber(pendingTransferCount)} بانتظار الاستلام</span>
            <span>·</span>
            <span>{formatNumber(inTransitCount)} قيد النقل</span>
          </div>
        </div>
        {transferRows.length === 0 ? (
          <EmptyText text="لا توجد تحويلات بعد." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-3 font-medium">الدفعة</th>
                  <th className="px-3 py-3 font-medium">من</th>
                  <th className="px-3 py-3 font-medium">إلى</th>
                  <th className="px-3 py-3 font-medium">الكمية</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transferRows.map((transfer) => {
                  const batch = singleRelation(transfer.batch);
                  return (
                    <tr key={transfer.id} className="align-top">
                      <td className="px-3 py-3 font-semibold text-slate-900" dir="ltr">
                        {batch?.batch_code ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDepartmentLabel(transfer.from_department)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDepartmentLabel(transfer.to_department)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatNumber(Number(transfer.quantity_sent))}</td>
                      <td className="px-3 py-3"><TransferStatusBadge status={transfer.status} /></td>
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

function BatchStatusBadge({ status }: { status: string | null }) {
  const className = status === "closed"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "in_transit"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "received"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      {formatLabel(BATCH_STATUS_LABELS, status)}
    </span>
  );
}

function TransferStatusBadge({ status }: { status: string | null }) {
  const className = status === "rejected"
    ? "border-red-200 bg-red-50 text-red-700"
    : status === "received"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      {formatLabel(TRANSFER_STATUS_LABELS, status)}
    </span>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{text}</div>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value);
}