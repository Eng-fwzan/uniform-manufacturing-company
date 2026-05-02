import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  BATCH_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVENTORY_CATEGORY_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TRACK_LABELS,
  PAYMENT_METHOD_LABELS,
  PURCHASE_STATUS_LABELS,
  QUALITY_RESULT_LABELS,
  QUANTITY_MOVEMENT_LABELS,
  TRANSFER_STATUS_LABELS,
  formatDepartmentLabel,
  formatLabel,
} from "@/lib/display-labels";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findReport, reportCards, type ReportSlug } from "../report-config";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type InventoryMovementSummary = { movement_type: string; quantity: number };
type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  variants?: Array<{
    id: string;
    color_name: string;
    color_code: string | null;
    is_active: boolean;
    inventory_movements?: InventoryMovementSummary[];
  }>;
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ report: string }>;
}) {
  const { report: reportSlug } = await params;
  const report = findReport(reportSlug);
  if (!report) notFound();

  await requirePermission("reports.view");
  const supabase = await createSupabaseServerClient();
  const content = await renderReport(report.slug, supabase);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/dashboard/reports" className="text-sm font-medium text-brand-600 hover:underline">
              الرجوع للتقارير
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{report.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{report.description}</p>
          </div>
          <ReportSwitcher activeSlug={report.slug} />
        </div>
      </header>

      {content}
    </div>
  );
}

function ReportSwitcher({ activeSlug }: { activeSlug: ReportSlug }) {
  return (
    <nav className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="التنقل بين التقارير">
      {reportCards.map((report) => (
        <Link
          key={report.slug}
          href={`/dashboard/reports/${report.slug}`}
          className={`shrink-0 rounded-md border px-3 py-2 text-xs font-medium ${
            report.slug === activeSlug
              ? "border-brand-300 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-300 hover:bg-white"
          }`}
        >
          {report.shortTitle}
        </Link>
      ))}
    </nav>
  );
}

async function renderReport(slug: ReportSlug, supabase: SupabaseServerClient) {
  switch (slug) {
    case "overview":
      return renderOverviewReport(supabase);
    case "orders":
      return renderOrdersReport(supabase);
    case "batches":
      return renderBatchesReport(supabase);
    case "transfers":
      return renderTransfersReport(supabase);
    case "inventory":
      return renderInventoryReport(supabase);
    case "purchases":
      return renderPurchasesReport(supabase);
    case "quality":
      return renderQualityReport(supabase);
    case "delivery":
      return renderDeliveryReport(supabase);
    case "finance":
      return renderFinanceReport(supabase);
    case "archive":
      return renderArchiveReport(supabase);
  }
}

async function renderOverviewReport(supabase: SupabaseServerClient) {
  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: orders },
    { data: batches },
    { data: transfers },
    { data: movements },
    { data: invoices },
    { data: payments },
  ] = await Promise.all([
    supabase.from("orders").select("status, due_date, track").limit(300),
    supabase.from("batches").select("status, current_department").limit(300),
    supabase.from("batch_transfers").select("status").limit(300),
    supabase.from("quantity_movements").select("quantity").limit(300),
    supabase.from("invoices").select("total_amount").limit(150),
    supabase.from("payments").select("amount").limit(150),
  ]);

  const orderRows = orders ?? [];
  const batchRows = batches ?? [];
  const transferRows = transfers ?? [];
  const movementRows = movements ?? [];
  const invoiceRows = invoices ?? [];
  const paymentRows = payments ?? [];
  const activeOrders = orderRows.filter((order) => ["draft", "in_progress"].includes(order.status)).length;
  const lateOrders = orderRows.filter(
    (order) => ["draft", "in_progress"].includes(order.status) && order.due_date && order.due_date < today,
  ).length;
  const openBatches = batchRows.filter((batch) => batch.status !== "closed").length;
  const pendingTransfers = transferRows.filter((transfer) => transfer.status === "sent").length;
  const movementQuantity = movementRows.reduce((sum, movement) => sum + Math.abs(Number(movement.quantity)), 0);
  const totalInvoices = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const paidAmount = paymentRows.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="طلبات نشطة" value={`${activeOrders}`} hint={`متأخرة: ${lateOrders}`} />
        <MetricCard label="دفعات مفتوحة" value={`${openBatches}`} hint={`بانتظار استلام: ${pendingTransfers}`} />
        <MetricCard label="فروقات كمية" value={formatNumber(movementQuantity)} hint={`${movementRows.length} حركة`} />
        <MetricCard label="المتبقي المالي" value={money(Math.max(totalInvoices - paidAmount, 0))} hint={`المدفوع: ${money(paidAmount)}`} />
      </section>
      <ReportPanel title="ملخص حالات الطلبات">
        <SummaryList
          items={Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
            label,
            value: `${orderRows.filter((order) => order.status === value).length}`,
          }))}
        />
      </ReportPanel>
    </div>
  );
}

async function renderOrdersReport(supabase: SupabaseServerClient) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, track, due_date, created_at, customer:customers(name), items:order_items(product_type, quantity)")
    .order("created_at", { ascending: false })
    .limit(150);
  const orderRows = orders ?? [];

  return (
    <ReportPanel title="قائمة الطلبات">
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <SummaryList
          items={Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
            label,
            value: `${orderRows.filter((order) => order.status === value).length}`,
          }))}
        />
        <ResponsiveTable
          columns={["الطلب", "العميل", "البند", "المسار", "الحالة", "التسليم"]}
          rows={orderRows.map((order) => {
            const customer = singleRelation(order.customer);
            const firstItem = order.items?.[0];
            return {
              "الطلب": <Link className="text-brand-600 hover:underline" href={`/dashboard/orders/${encodeURIComponent(order.order_number)}`}>{order.order_number}</Link>,
              "العميل": customer?.name ?? "—",
              "البند": firstItem ? `${firstItem.product_type} - ${firstItem.quantity}` : "—",
              "المسار": formatLabel(ORDER_TRACK_LABELS, order.track),
              "الحالة": formatLabel(ORDER_STATUS_LABELS, order.status),
              "التسليم": order.due_date ?? "—",
            };
          })}
        />
      </div>
    </ReportPanel>
  );
}

async function renderBatchesReport(supabase: SupabaseServerClient) {
  const { data: batches } = await supabase
    .from("batches")
    .select("id, batch_code, status, current_department, quantity, created_at, order:orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(150);

  return (
    <ReportPanel title="قائمة الدفعات">
      <ResponsiveTable
        columns={["الدفعة", "الطلب", "القسم", "الكمية", "الحالة", "الإنشاء"]}
        rows={(batches ?? []).map((batch) => ({
          "الدفعة": batch.batch_code,
          "الطلب": singleRelation(batch.order)?.order_number ?? "—",
          "القسم": formatDepartmentLabel(batch.current_department),
          "الكمية": batch.quantity,
          "الحالة": formatLabel(BATCH_STATUS_LABELS, batch.status),
          "الإنشاء": formatDate(batch.created_at),
        }))}
      />
    </ReportPanel>
  );
}

async function renderTransfersReport(supabase: SupabaseServerClient) {
  const [{ data: transfers }, { data: movements }] = await Promise.all([
    supabase
      .from("batch_transfers")
      .select("id, from_department, to_department, quantity_sent, quantity_received, status, sent_at, received_at, batch:batches(batch_code)")
      .order("sent_at", { ascending: false })
      .limit(150),
    supabase
      .from("quantity_movements")
      .select("id, movement_type, quantity, reason, department, created_at, order:orders(order_number), batch:batches(batch_code)")
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ReportPanel title="تحويلات الدفعات">
        <ResponsiveTable
          columns={["الدفعة", "من", "إلى", "المرسل", "المستلم", "الحالة"]}
          rows={(transfers ?? []).map((transfer) => ({
            "الدفعة": singleRelation(transfer.batch)?.batch_code ?? "—",
            "من": formatDepartmentLabel(transfer.from_department),
            "إلى": formatDepartmentLabel(transfer.to_department),
            "المرسل": transfer.quantity_sent,
            "المستلم": transfer.quantity_received ?? "—",
            "الحالة": formatLabel(TRANSFER_STATUS_LABELS, transfer.status),
          }))}
        />
      </ReportPanel>
      <ReportPanel title="حركات الكميات">
        <ResponsiveTable
          columns={["الطلب", "الدفعة", "القسم", "النوع", "الكمية", "السبب"]}
          rows={(movements ?? []).map((movement) => ({
            "الطلب": singleRelation(movement.order)?.order_number ?? "—",
            "الدفعة": singleRelation(movement.batch)?.batch_code ?? "—",
            "القسم": formatDepartmentLabel(movement.department),
            "النوع": formatLabel(QUANTITY_MOVEMENT_LABELS, movement.movement_type),
            "الكمية": movement.quantity,
            "السبب": movement.reason,
          }))}
        />
      </ReportPanel>
    </div>
  );
}

async function renderInventoryReport(supabase: SupabaseServerClient) {
  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, name, category, unit, variants:inventory_item_variants(id, color_name, color_code, is_active, inventory_movements(movement_type, quantity))")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const inventoryRows = ((inventoryItems ?? []) as InventoryItem[]).flatMap((item) =>
    (item.variants ?? [])
      .filter((variant) => variant.is_active)
      .map((variant) => {
        const balance = summarizeInventoryMovements(variant.inventory_movements ?? []);
        return {
          "الصنف": item.name,
          "اللون": variant.color_name,
          "التصنيف": formatLabel(INVENTORY_CATEGORY_LABELS, item.category),
          "الرصيد الفعلي": `${formatNumber(balance.physicalBalance)} ${item.unit}`,
          "المحجوز": `${formatNumber(balance.reservedQuantity)} ${item.unit}`,
          "المتاح": `${formatNumber(balance.availableBalance)} ${item.unit}`,
        };
      }),
  );

  return (
    <ReportPanel title="أرصدة المخزون">
      <ResponsiveTable columns={["الصنف", "اللون", "التصنيف", "الرصيد الفعلي", "المحجوز", "المتاح"]} rows={inventoryRows} />
    </ReportPanel>
  );
}

async function renderPurchasesReport(supabase: SupabaseServerClient) {
  const { data: purchases } = await supabase
    .from("purchase_requests")
    .select("id, request_number, status, department, needed_by, created_at, items:purchase_request_items(item_name, category, quantity, unit)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <ReportPanel title="طلبات الشراء">
      <ResponsiveTable
        columns={["رقم الطلب", "الحالة", "القسم", "الصنف", "الكمية", "مطلوب قبل"]}
        rows={(purchases ?? []).map((request) => {
          const item = request.items?.[0];
          return {
            "رقم الطلب": request.request_number,
            "الحالة": formatLabel(PURCHASE_STATUS_LABELS, request.status),
            "القسم": formatDepartmentLabel(request.department),
            "الصنف": item ? `${item.item_name} · ${formatLabel(INVENTORY_CATEGORY_LABELS, item.category)}` : "—",
            "الكمية": item ? `${item.quantity} ${item.unit}` : "—",
            "مطلوب قبل": request.needed_by ?? "—",
          };
        })}
      />
    </ReportPanel>
  );
}

async function renderQualityReport(supabase: SupabaseServerClient) {
  const { data: qualityRecords } = await supabase
    .from("quality_records")
    .select("id, result, checked_quantity, failed_quantity, created_at, batch:batches(batch_code), order:orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(120);

  return (
    <ReportPanel title="سجلات الجودة">
      <ResponsiveTable
        columns={["الدفعة", "الطلب", "النتيجة", "المفحوص", "المرفوض", "التاريخ"]}
        rows={(qualityRecords ?? []).map((record) => ({
          "الدفعة": singleRelation(record.batch)?.batch_code ?? "—",
          "الطلب": singleRelation(record.order)?.order_number ?? "—",
          "النتيجة": formatLabel(QUALITY_RESULT_LABELS, record.result),
          "المفحوص": record.checked_quantity,
          "المرفوض": record.failed_quantity,
          "التاريخ": formatDate(record.created_at),
        }))}
      />
    </ReportPanel>
  );
}

async function renderDeliveryReport(supabase: SupabaseServerClient) {
  const { data: deliveries } = await supabase
    .from("delivery_records")
    .select("id, delivered_quantity, recipient_name, delivered_at, batch:batches(batch_code), order:orders(order_number)")
    .order("delivered_at", { ascending: false })
    .limit(120);

  return (
    <ReportPanel title="سجلات التسليم">
      <ResponsiveTable
        columns={["الدفعة", "الطلب", "الكمية", "المستلم", "التاريخ"]}
        rows={(deliveries ?? []).map((delivery) => ({
          "الدفعة": singleRelation(delivery.batch)?.batch_code ?? "—",
          "الطلب": singleRelation(delivery.order)?.order_number ?? "—",
          "الكمية": delivery.delivered_quantity,
          "المستلم": delivery.recipient_name,
          "التاريخ": formatDate(delivery.delivered_at),
        }))}
      />
    </ReportPanel>
  );
}

async function renderFinanceReport(supabase: SupabaseServerClient) {
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status, due_date, total_amount, order:orders(order_number), customer:customers(name), payments(amount)")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("payments")
      .select("id, amount, method, payment_date, invoice:invoices(invoice_number)")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ReportPanel title="الفواتير">
        <ResponsiveTable
          columns={["الفاتورة", "الطلب", "العميل", "الإجمالي", "المدفوع", "الحالة", "الاستحقاق"]}
          rows={(invoices ?? []).map((invoice) => {
            const invoicePayments = invoice.payments ?? [];
            const invoicePaid = invoicePayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
            return {
              "الفاتورة": invoice.invoice_number,
              "الطلب": singleRelation(invoice.order)?.order_number ?? "—",
              "العميل": singleRelation(invoice.customer)?.name ?? "—",
              "الإجمالي": money(Number(invoice.total_amount)),
              "المدفوع": money(invoicePaid),
              "الحالة": formatLabel(INVOICE_STATUS_LABELS, invoice.status),
              "الاستحقاق": invoice.due_date ?? "—",
            };
          })}
        />
      </ReportPanel>
      <ReportPanel title="المدفوعات">
        <ResponsiveTable
          columns={["الفاتورة", "المبلغ", "الطريقة", "التاريخ"]}
          rows={(payments ?? []).map((payment) => ({
            "الفاتورة": singleRelation(payment.invoice)?.invoice_number ?? "—",
            "المبلغ": money(Number(payment.amount)),
            "الطريقة": formatLabel(PAYMENT_METHOD_LABELS, payment.method),
            "التاريخ": payment.payment_date ?? "—",
          }))}
        />
      </ReportPanel>
    </div>
  );
}

async function renderArchiveReport(supabase: SupabaseServerClient) {
  const [{ data: orderFiles }, { data: auditLogs }, { count: customerCount }] = await Promise.all([
    supabase
      .from("order_files")
      .select("id, file_type, file_name, created_at, order:orders(order_number)")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, created_at, user:app_users(full_name)")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        إجمالي العملاء المسجلين: {customerCount ?? 0}. تقارير الأرشيف تقرأ من الملفات وسجل التدقيق مباشرة.
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportPanel title="ملفات الطلبات">
          <ResponsiveTable
            columns={["الطلب", "نوع الملف", "الملف", "التاريخ"]}
            rows={(orderFiles ?? []).map((file) => ({
              "الطلب": singleRelation(file.order)?.order_number ?? "—",
              "نوع الملف": file.file_type,
              "الملف": file.file_name,
              "التاريخ": formatDate(file.created_at),
            }))}
          />
        </ReportPanel>
        <ReportPanel title="سجل التدقيق">
          <ResponsiveTable
            columns={["العملية", "الكيان", "المعرف", "المستخدم", "الوقت"]}
            rows={(auditLogs ?? []).map((log) => ({
              "العملية": log.action,
              "الكيان": log.entity_type,
              "المعرف": log.entity_id ?? "—",
              "المستخدم": singleRelation(log.user)?.full_name ?? "—",
              "الوقت": formatDateTime(log.created_at),
            }))}
          />
        </ReportPanel>
      </div>
    </div>
  );
}

function ReportPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
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

function SummaryList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">{item.label}</span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponsiveTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, ReactNode>> }) {
  if (rows.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">لا توجد بيانات بعد.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full bg-white text-xs sm:text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr className="text-right">
            {columns.map((column) => (
              <th key={column} className="px-2 py-2 font-medium sm:px-3">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className="px-2 py-2 text-slate-700 sm:px-3">{row[column] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
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