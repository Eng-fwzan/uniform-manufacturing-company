import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatLabel } from "@/lib/display-labels";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";
import AddOrderItemForm from "./add-order-item-form";
import OrderAssetUploadForm from "./order-asset-upload-form";
import OrderStatusActions from "./order-status-actions";

const ORDER_TRACK_LABELS: Record<string, string> = {
  production: "إنتاج",
  sample: "عينة",
  modification: "تعديل",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  archived: "مؤرشف",
  cancelled: "ملغي",
};

const CUSTOMER_CLASSIFICATION_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit_approved: "آجل معتمد",
  overdue: "متعثر",
};

const BATCH_STATUS_LABELS: Record<string, string> = {
  open: "مفتوحة",
  in_transit: "قيد التحويل",
  received: "مستلمة",
  closed: "مغلقة",
};

const TRANSFER_STATUS_LABELS: Record<string, string> = {
  sent: "مرسلة",
  received: "مستلمة",
  rejected: "مرفوضة",
};

const MOVEMENT_LABELS: Record<string, string> = {
  extra_cut: "زيادة قص",
  shortage: "نقص",
  damaged: "تالف",
  waste: "هدر",
  free_giveaway: "تسليم مجاني",
  rework: "إعادة عمل",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  design: "تصميم الزي",
  embroidery_logo: "شعار التطريز",
  mockup: "اعتماد",
  delivery_note: "سند تسليم",
  invoice: "فاتورة",
  photo: "صورة",
  other: "أخرى",
};

const QUALITY_RESULT_LABELS: Record<string, string> = {
  passed: "ناجح",
  failed: "مرفوض",
  rework: "إعادة عمل",
};

type JsonObject = Record<string, unknown>;

type OrderDetails = {
  id: string;
  order_number: string;
  status: string;
  track: string;
  due_date: string | null;
  notes: string | null;
  created_at: string | null;
  customer: {
    name: string;
    phone: string | null;
    classification: string;
    credit_limit: number | null;
    payment_terms_days: number | null;
  } | Array<{
    name: string;
    phone: string | null;
    classification: string;
    credit_limit: number | null;
    payment_terms_days: number | null;
  }> | null;
  creator: {
    full_name: string;
  } | Array<{
    full_name: string;
  }> | null;
};

type OrderItem = {
  id: string;
  product_type: string;
  fabric: string | null;
  color: string | null;
  fabric_consumption: number;
  embroidery_spec: string | null;
  size_breakdown: JsonObject | null;
  accessories: JsonObject | null;
  measurements: JsonObject | null;
  quantity: number;
  notes: string | null;
  inventory_item: { name: string; unit: string } | Array<{ name: string; unit: string }> | null;
  inventory_variant: { color_name: string; color_code: string | null } | Array<{ color_name: string; color_code: string | null }> | null;
};

type Batch = {
  id: string;
  batch_code: string;
  current_department: DepartmentCode | null;
  quantity: number;
  status: string;
  order_item_id: string | null;
  created_at: string | null;
};

type Transfer = {
  id: string;
  batch_id: string;
  from_department: DepartmentCode | null;
  to_department: DepartmentCode;
  quantity_sent: number;
  quantity_received: number | null;
  status: string;
  sent_at: string | null;
  received_at: string | null;
  notes: string | null;
  batch: { batch_code: string } | Array<{ batch_code: string }> | null;
};

type QuantityMovement = {
  id: string;
  batch_id: string | null;
  department: DepartmentCode | null;
  movement_type: string;
  quantity: number;
  reason: string;
  created_at: string | null;
  batch: { batch_code: string } | Array<{ batch_code: string }> | null;
  recorder: { full_name: string } | Array<{ full_name: string }> | null;
};

type ChecklistItem = {
  item_key: string;
  is_done: boolean;
  template: { label: string } | Array<{ label: string }> | null;
};

type OrderFile = {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  description: string | null;
  created_at: string | null;
};

type QualityRecord = {
  id: string;
  batch_id: string;
  result: string;
  checked_quantity: number;
  failed_quantity: number;
  notes: string | null;
  created_at: string | null;
  batch: { batch_code: string } | Array<{ batch_code: string }> | null;
  checker: { full_name: string } | Array<{ full_name: string }> | null;
};

type DeliveryRecord = {
  id: string;
  batch_id: string;
  delivered_quantity: number;
  recipient_name: string;
  recipient_phone: string | null;
  notes: string | null;
  delivered_at: string | null;
  batch: { batch_code: string } | Array<{ batch_code: string }> | null;
  deliverer: { full_name: string } | Array<{ full_name: string }> | null;
};

type InvoiceRecord = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }> | null;
  payments: Array<{
    amount: number;
    payment_date: string | null;
    method: string;
    reference_number: string | null;
  }> | null;
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

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await requirePermission("orders.view");
  const { orderId: orderRefParam } = await params;
  const orderRef = decodeURIComponent(orderRefParam);
  const supabase = await createSupabaseServerClient();
  const orderLookupColumn = isUuid(orderRef) ? "id" : "order_number";

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, track, due_date, notes, created_at, customer:customers(name, phone, classification, credit_limit, payment_terms_days), creator:app_users(full_name)",
    )
    .eq(orderLookupColumn, orderRef)
    .maybeSingle<OrderDetails>();

  if (!order) notFound();

  const [
    { data: items },
    { data: batches },
    { data: movements },
    { data: checklist },
    { data: files },
    { data: qualityRecords },
    { data: deliveryRecords },
    { data: invoices },
    { data: fabricItems },
  ] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, product_type, fabric, color, fabric_consumption, embroidery_spec, size_breakdown, accessories, measurements, quantity, notes, inventory_item:inventory_items(name, unit), inventory_variant:inventory_item_variants(color_name, color_code)")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("batches")
      .select("id, batch_code, current_department, quantity, status, order_item_id, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("quantity_movements")
      .select("id, batch_id, department, movement_type, quantity, reason, created_at, batch:batches(batch_code), recorder:app_users(full_name)")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_archive_checklist")
      .select("item_key, is_done, template:archive_checklist_templates(label)")
      .eq("order_id", order.id)
      .order("item_key", { ascending: true }),
    supabase
      .from("order_files")
      .select("id, file_name, file_type, file_path, description, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("quality_records")
      .select("id, batch_id, result, checked_quantity, failed_quantity, notes, created_at, batch:batches(batch_code), checker:app_users(full_name)")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("delivery_records")
      .select("id, batch_id, delivered_quantity, recipient_name, recipient_phone, notes, delivered_at, batch:batches(batch_code), deliverer:app_users(full_name)")
      .eq("order_id", order.id)
      .order("delivered_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, subtotal_amount, discount_amount, tax_amount, total_amount, items:invoice_items(description, quantity, unit_price, total_amount), payments(amount, payment_date, method, reference_number)")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, category, unit, variants:inventory_item_variants(id, color_name, is_active, inventory_movements(movement_type, quantity))")
      .eq("is_active", true)
      .eq("category", "fabric")
      .order("created_at", { ascending: false }),
  ]);

  const batchRows = (batches ?? []) as Batch[];
  const batchIds = batchRows.map((batch) => batch.id);
  const { data: transfers } = batchIds.length > 0
    ? await supabase
        .from("batch_transfers")
        .select("id, batch_id, from_department, to_department, quantity_sent, quantity_received, status, sent_at, received_at, notes, batch:batches(batch_code)")
        .in("batch_id", batchIds)
        .order("sent_at", { ascending: false })
    : { data: [] };

  const fileRows = (files ?? []) as OrderFile[];
  const filesWithUrls = await Promise.all(
    fileRows.map(async (file) => {
      const { data } = await supabase.storage
        .from("order-files")
        .createSignedUrl(file.file_path, 60 * 60);

      return { ...file, signedUrl: data?.signedUrl ?? null };
    }),
  );

  const customer = singleRelation(order.customer);
  const creator = singleRelation(order.creator);
  const itemRows = (items ?? []) as OrderItem[];
  const transferRows = (transfers ?? []) as Transfer[];
  const movementRows = (movements ?? []) as QuantityMovement[];
  const checklistRows = (checklist ?? []) as ChecklistItem[];
  const qualityRows = (qualityRecords ?? []) as QualityRecord[];
  const deliveryRows = (deliveryRecords ?? []) as DeliveryRecord[];
  const invoiceRows = (invoices ?? []) as InvoiceRecord[];
  const completedChecklistItems = checklistRows.filter((item) => item.is_done).length;
  const totalBatchQuantity = batchRows.reduce((sum, batch) => sum + Number(batch.quantity), 0);
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
  const canCancelOrder =
    !["completed", "archived", "cancelled"].includes(order.status) &&
    batchRows.length === 0 &&
    invoiceRows.length === 0;
  const canAddItem =
    hasPermission(user.role, "orders.update") &&
    !["completed", "archived", "cancelled"].includes(order.status);
  const canUploadOrderAssets =
    hasPermission(user.role, "orders.update") &&
    !["archived", "cancelled"].includes(order.status);

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header className="space-y-4">
        <Link href="/dashboard/orders" className="text-sm text-brand-600 hover:underline">
          الرجوع إلى الطلبات
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm text-slate-500">ملف الطلب</div>
            <h1 className="mt-1 text-3xl font-bold text-slate-900" dir="ltr">
              {order.order_number}
            </h1>
            <p className="mt-2 text-slate-600">
              {customer?.name ?? "عميل غير محدد"} · {ORDER_TRACK_LABELS[order.track] ?? order.track}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[32rem]">
            <StatCard label="حالة الطلب" value={ORDER_STATUS_LABELS[order.status] ?? order.status} />
            <StatCard label="إجمالي الدفعات" value={`${batchRows.length}`} />
            <StatCard label="كمية الدفعات" value={`${totalBatchQuantity}`} />
          </div>
        </div>
        {canCancelOrder && <OrderStatusActions orderId={order.id} />}
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <InfoCard title="بيانات الطلب">
          <InfoRow label="المسار" value={ORDER_TRACK_LABELS[order.track] ?? order.track} />
          <InfoRow label="الحالة" value={ORDER_STATUS_LABELS[order.status] ?? order.status} />
          <InfoRow label="تاريخ التسليم" value={formatDate(order.due_date)} />
          <InfoRow label="أنشئ بواسطة" value={creator?.full_name ?? "—"} />
          <InfoRow label="تاريخ الإنشاء" value={formatDate(order.created_at)} />
          {order.notes && <InfoBlock label="ملاحظات" value={order.notes} />}
        </InfoCard>

        <InfoCard title="بيانات العميل">
          <InfoRow label="الاسم" value={customer?.name ?? "—"} />
          <InfoRow label="الهاتف" value={customer?.phone ?? "—"} dir="ltr" />
          <InfoRow
            label="التصنيف"
            value={customer ? CUSTOMER_CLASSIFICATION_LABELS[customer.classification] ?? customer.classification : "—"}
          />
          <InfoRow label="الحد الائتماني" value={formatNumber(customer?.credit_limit)} />
          <InfoRow label="مدة السداد" value={customer?.payment_terms_days != null ? `${customer.payment_terms_days} يوم` : "—"} />
        </InfoCard>

        <InfoCard title="الأرشفة">
          <InfoRow label="المكتمل" value={`${completedChecklistItems} / ${checklistRows.length}`} />
          <InfoRow label="الملفات" value={`${filesWithUrls.length}`} />
          <div className="mt-4 space-y-2">
            {checklistRows.length === 0 ? (
              <div className="text-sm text-slate-600">لا توجد قائمة أرشفة لهذا الطلب.</div>
            ) : (
              checklistRows.map((item) => (
                <div key={item.item_key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700">{singleRelation(item.template)?.label ?? item.item_key}</span>
                  <span className={item.is_done ? "text-emerald-700" : "text-slate-400"}>
                    {item.is_done ? "مكتمل" : "بانتظار"}
                  </span>
                </div>
              ))
            )}
          </div>
        </InfoCard>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">الفاتورة والمدفوعات</h2>
          <Link href="/dashboard/finance" className="text-sm text-brand-600 hover:underline">
            شاشة الفواتير
          </Link>
        </div>
        {invoiceRows.length === 0 ? (
          <EmptyState text="لا توجد فاتورة مرتبطة بهذا الطلب بعد." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الفاتورة</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">الإجمالي</th>
                  <th className="py-2 px-3">المدفوع</th>
                  <th className="py-2 px-3">المتبقي</th>
                  <th className="py-2 px-3">الاستحقاق</th>
                  <th className="py-2 px-3">آخر سداد</th>
                  <th className="py-2 px-3">طباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoiceRows.map((invoice) => {
                  const paidAmount = sumInvoicePayments(invoice.payments ?? []);
                  const remainingAmount = Math.max(Number(invoice.total_amount) - paidAmount, 0);
                  const latestPayment = invoice.payments?.[0] ?? null;

                  return (
                    <tr key={invoice.id}>
                      <td className="py-2 px-3 font-medium text-slate-900" dir="ltr">{invoice.invoice_number}</td>
                      <td className="py-2 px-3">{formatLabel(INVOICE_STATUS_LABELS, invoice.status)}</td>
                      <td className="py-2 px-3">{money(Number(invoice.total_amount))}</td>
                      <td className="py-2 px-3">{money(paidAmount)}</td>
                      <td className="py-2 px-3">{money(remainingAmount)}</td>
                      <td className="py-2 px-3" dir="ltr">{invoice.due_date ?? "—"}</td>
                      <td className="py-2 px-3">
                        {latestPayment
                          ? `${money(Number(latestPayment.amount))} · ${formatLabel(PAYMENT_METHOD_LABELS, latestPayment.method)}`
                          : "—"}
                      </td>
                      <td className="py-2 px-3">
                        <Link href={`/dashboard/finance/${invoice.id}/print`} className="text-brand-600 hover:underline">
                          فتح
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">بنود الطلب</h2>
          <div className="text-sm text-slate-500">{itemRows.length} بند</div>
        </div>

        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-600">
            إضافة بند جديد لهذا الطلب
          </summary>
          <div className="mt-4">
            <AddOrderItemForm
              canAdd={canAddItem}
              orderId={order.id}
              fabricVariants={fabricVariants}
            />
          </div>
        </details>

        {itemRows.length === 0 ? (
          <EmptyState text="لا توجد بنود لهذا الطلب." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {itemRows.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{item.product_type}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span>{item.fabric ?? "قماش غير محدد"}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-2">
                        <ColorSwatch color={singleRelation(item.inventory_variant)?.color_code ?? null} />
                        {item.color ?? "لون غير محدد"}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-white px-3 py-1 text-sm text-slate-700">
                    {item.quantity} قطعة
                  </span>
                </div>
                <InfoRow label="المقاسات" value={formatSizes(item.size_breakdown)} />
                <InfoRow label="استهلاك القماش" value={formatFabricConsumption(item)} />
                <InfoRow label="التطريز" value={item.embroidery_spec ?? "—"} />
                <InfoRow label="التوابع" value={formatJsonSummary(item.accessories)} />
                <InfoRow label="القياسات" value={formatJsonSummary(item.measurements)} />
                {item.notes && <InfoBlock label="ملاحظات البند" value={item.notes} />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">الدفعات</h2>
          <Link href="/dashboard/batches" className="text-sm text-brand-600 hover:underline">
            إدارة الدفعات
          </Link>
        </div>
        {batchRows.length === 0 ? (
          <EmptyState text="لا توجد دفعات مرتبطة بهذا الطلب." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الكود</th>
                  <th className="py-2 px-3">القسم الحالي</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batchRows.map((batch) => (
                  <tr key={batch.id}>
                    <td className="py-2 px-3 font-medium text-slate-900" dir="ltr">{batch.batch_code}</td>
                    <td className="py-2 px-3">{formatDepartment(batch.current_department)}</td>
                    <td className="py-2 px-3">{batch.quantity}</td>
                    <td className="py-2 px-3">{BATCH_STATUS_LABELS[batch.status] ?? batch.status}</td>
                    <td className="py-2 px-3" dir="ltr">{formatDate(batch.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">مسار التحويلات</h2>
        {transferRows.length === 0 ? (
          <EmptyState text="لا توجد تحويلات مرتبطة بدفعات هذا الطلب." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الدفعة</th>
                  <th className="py-2 px-3">من</th>
                  <th className="py-2 px-3">إلى</th>
                  <th className="py-2 px-3">المرسل</th>
                  <th className="py-2 px-3">المستلم</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">الإرسال</th>
                  <th className="py-2 px-3">الاستلام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transferRows.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="py-2 px-3 font-medium text-slate-900" dir="ltr">
                      {singleRelation(transfer.batch)?.batch_code ?? "—"}
                    </td>
                    <td className="py-2 px-3">{formatDepartment(transfer.from_department)}</td>
                    <td className="py-2 px-3">{formatDepartment(transfer.to_department)}</td>
                    <td className="py-2 px-3">{transfer.quantity_sent}</td>
                    <td className="py-2 px-3">{transfer.quantity_received ?? "—"}</td>
                    <td className="py-2 px-3">{TRANSFER_STATUS_LABELS[transfer.status] ?? transfer.status}</td>
                    <td className="py-2 px-3" dir="ltr">{formatDateTime(transfer.sent_at)}</td>
                    <td className="py-2 px-3" dir="ltr">{formatDateTime(transfer.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">الجودة</h2>
            <Link href="/dashboard/quality" className="text-sm text-brand-600 hover:underline">
              شاشة الجودة
            </Link>
          </div>
          {qualityRows.length === 0 ? (
            <EmptyState text="لا توجد سجلات جودة على هذا الطلب." />
          ) : (
            <div className="space-y-3">
              {qualityRows.map((record) => (
                <div key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {QUALITY_RESULT_LABELS[record.result] ?? record.result}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {singleRelation(record.batch)?.batch_code ?? "—"} · {singleRelation(record.checker)?.full_name ?? "—"}
                      </div>
                    </div>
                    <span className="rounded-lg bg-white px-3 py-1 text-sm text-slate-700">
                      {record.checked_quantity} / {record.failed_quantity}
                    </span>
                  </div>
                  {record.notes && <div className="mt-3 text-sm text-slate-700">{record.notes}</div>}
                  <div className="mt-2 text-xs text-slate-500">{formatDateTime(record.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">التسليم</h2>
            <Link href="/dashboard/delivery" className="text-sm text-brand-600 hover:underline">
              شاشة التسليم
            </Link>
          </div>
          {deliveryRows.length === 0 ? (
            <EmptyState text="لا توجد سجلات تسليم على هذا الطلب." />
          ) : (
            <div className="space-y-3">
              {deliveryRows.map((record) => (
                <div key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{record.recipient_name}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {singleRelation(record.batch)?.batch_code ?? "—"} · {singleRelation(record.deliverer)?.full_name ?? "—"}
                      </div>
                    </div>
                    <span className="rounded-lg bg-white px-3 py-1 text-sm text-slate-700">
                      {record.delivered_quantity}
                    </span>
                  </div>
                  {record.notes && <div className="mt-3 text-sm text-slate-700">{record.notes}</div>}
                  <div className="mt-2 text-xs text-slate-500">{formatDateTime(record.delivered_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">حركات الكميات</h2>
            <Link href="/dashboard/movements" className="text-sm text-brand-600 hover:underline">
              كل الحركات
            </Link>
          </div>
          {movementRows.length === 0 ? (
            <EmptyState text="لا توجد فروقات كمية على هذا الطلب." />
          ) : (
            <div className="space-y-3">
              {movementRows.map((movement) => (
                <div key={movement.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {MOVEMENT_LABELS[movement.movement_type] ?? movement.movement_type}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {singleRelation(movement.batch)?.batch_code ?? "بدون دفعة"} · {formatDepartment(movement.department)}
                      </div>
                    </div>
                    <span className="rounded-lg bg-white px-3 py-1 text-sm text-slate-700">
                      {movement.quantity}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-slate-700">{movement.reason}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {singleRelation(movement.recorder)?.full_name ?? "—"} · {formatDateTime(movement.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">ملفات الطلب</h2>

          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-brand-600">
              رفع صورة تصميم أو شعار تطريز
            </summary>
            <div className="mt-4">
              <OrderAssetUploadForm orderId={order.id} canUpload={canUploadOrderAssets} />
            </div>
          </details>

          {filesWithUrls.length === 0 ? (
            <EmptyState text="لا توجد ملفات مرفوعة لهذا الطلب." />
          ) : (
            <div className="space-y-3">
              {filesWithUrls.map((file) => (
                <div key={file.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    {file.signedUrl && isVisualOrderFile(file.file_type) && (
                      <a href={file.signedUrl} target="_blank" rel="noreferrer" className="shrink-0">
                        <Image
                          src={file.signedUrl}
                          alt={file.file_name}
                          width={96}
                          height={80}
                          unoptimized
                          className="h-20 w-24 rounded-md border border-slate-200 bg-white object-cover"
                        />
                      </a>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">{file.file_name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {FILE_TYPE_LABELS[file.file_type] ?? file.file_type} · {formatDateTime(file.created_at)}
                      </div>
                      {file.description && (
                        <div className="mt-2 text-sm leading-6 text-slate-700">{file.description}</div>
                      )}
                    </div>
                  </div>
                  {file.signedUrl ? (
                    <a className="text-sm text-brand-600 hover:underline" href={file.signedUrl} target="_blank" rel="noreferrer">
                      فتح
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value, dir }: { label: string; value: string; dir?: "rtl" | "ltr" }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-left font-medium text-slate-900" dir={dir}>{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 text-slate-800">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{text}</div>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("ar").format(Number(value));
}

function money(value: number) {
  return `${new Intl.NumberFormat("ar", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ريال`;
}

function sumInvoicePayments(payments: Array<{ amount: number }>) {
  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function ColorSwatch({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded border border-slate-300 align-middle"
      style={{ backgroundColor: color ?? "#f8fafc" }}
    />
  );
}

function formatFabricConsumption(item: OrderItem) {
  const inventoryItem = singleRelation(item.inventory_item);
  const unit = inventoryItem?.unit ?? "وحدة";
  const consumption = Number(item.fabric_consumption ?? 0);

  return consumption > 0 ? `${consumption} ${unit}` : "—";
}

function formatDepartment(department: DepartmentCode | null | undefined) {
  if (!department) return "—";
  return DEPARTMENT_LABELS[department] ?? department;
}

function formatSizes(sizeBreakdown: JsonObject | null) {
  if (!sizeBreakdown) return "—";

  const standard = ["S", "M", "L", "XL"]
    .map((size) => `${size}: ${Number(sizeBreakdown[size] ?? 0)}`)
    .join(" / ");
  const custom = typeof sizeBreakdown.custom === "string" && sizeBreakdown.custom.trim()
    ? ` / ${sizeBreakdown.custom.trim()}`
    : "";

  return `${standard}${custom}`;
}

function formatJsonSummary(value: JsonObject | null) {
  if (!value) return "—";

  const entries = Object.entries(value).filter(([, entryValue]) => {
    if (entryValue == null) return false;
    if (typeof entryValue === "string") return entryValue.trim().length > 0;
    return true;
  });

  if (entries.length === 0) return "—";

  return entries
    .map(([key, entryValue]) => `${key}: ${String(entryValue)}`)
    .join(" / ");
}

function isVisualOrderFile(fileType: string) {
  return ["design", "embroidery_logo", "mockup", "photo"].includes(fileType);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}