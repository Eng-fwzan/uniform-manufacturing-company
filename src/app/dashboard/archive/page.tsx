import { requirePermission } from "@/lib/auth/require-permission";
import { ORDER_STATUS_LABELS, ORDER_TRACK_LABELS, formatLabel } from "@/lib/display-labels";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ArchivePanel from "./archive-panel";

type OrderItemSummary = {
  product_type: string;
  quantity: number;
  fabric: string | null;
  color: string | null;
};

export default async function ArchivePage() {
  await requirePermission("archive.complete");
  const supabase = await createSupabaseServerClient();

  const [{ data: orders }, { data: checklist }, { data: files }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, track, due_date, notes, created_at, customer:customers(name), items:order_items(product_type, quantity, fabric, color)")
      .order("created_at", { ascending: false }),
    supabase
      .from("order_archive_checklist")
      .select("order_id, item_key, is_done, template:archive_checklist_templates(label)")
      .order("order_id", { ascending: true }),
    supabase
      .from("order_files")
      .select("id, order_id, file_name, file_type, description, created_at, file_path")
      .order("created_at", { ascending: false }),
  ]);

  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (file) => {
      const { data } = await supabase.storage
        .from("order-files")
        .createSignedUrl(file.file_path, 60 * 60);

      return {
        id: file.id as string,
        order_id: file.order_id as string,
        file_name: file.file_name,
        file_type: file.file_type,
        description: file.description,
        created_at: file.created_at,
        signed_url: data?.signedUrl ?? null,
      };
    }),
  );

  const archiveOrders = (orders ?? []).map((order) => {
    const customer = singleRelation(order.customer);
    const items = (order.items ?? []) as OrderItemSummary[];

    return {
      id: order.id as string,
      order_number: order.order_number,
      customer_name: customer?.name ?? "—",
      status: order.status,
      track: order.track,
      due_date: order.due_date,
      created_at: order.created_at,
      notes: order.notes,
      item_summary: items.length > 0
        ? items.map((item) => `${item.product_type} - ${item.quantity} (${item.fabric ?? "—"} / ${item.color ?? "—"})`).join("، ")
        : "—",
    };
  });

  const checklistItems = (checklist ?? []).map((item) => ({
    order_id: item.order_id as string,
    item_key: item.item_key,
    label: singleRelation(item.template)?.label ?? item.item_key,
    is_done: item.is_done,
  }));

  const archivedCount = archiveOrders.filter((order) => order.status === "archived").length;
  const completedChecklistCount = checklistItems.filter((item) => item.is_done).length;

  return (
    <div className="mx-auto max-w-7xl p-8 space-y-8">
      <header className="space-y-4">
        <div>
          <div className="text-sm font-medium text-brand-600">الأرشفة</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">الأرشفة والملفات</h1>
          <p className="mt-2 text-slate-600">
            البحث عن طلب قديم، مراجعة ملفاته، إكمال قائمة الإغلاق، وترحيل نسخة جديدة إلى قائمة الطلبات.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="إجمالي الطلبات" value={`${archiveOrders.length}`} />
          <SummaryTile label="طلبات مؤرشفة" value={`${archivedCount}`} />
          <SummaryTile label="ملفات محفوظة" value={`${filesWithUrls.length}`} />
          <SummaryTile label="عناصر مكتملة" value={`${completedChecklistCount}`} />
        </div>
      </header>

      <ArchivePanel orders={archiveOrders} checklist={checklistItems} files={filesWithUrls} />

      <section className="card text-sm text-slate-600">
        الحالات الحالية: {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => `${label}: ${archiveOrders.filter((order) => order.status === value).length}`).join(" · ")}
        <span className="mx-2 text-slate-300">|</span>
        المسارات: {Object.keys(ORDER_TRACK_LABELS).map((value) => `${formatLabel(ORDER_TRACK_LABELS, value)}: ${archiveOrders.filter((order) => order.track === value).length}`).join(" · ")}
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}