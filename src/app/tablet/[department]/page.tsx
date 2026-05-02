import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { singleRelation } from "@/lib/supabase/relations";
import { getTabletSession } from "@/lib/tablet/session";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";
import TabletDepartmentPanel, {
  type TabletBatch,
  type TabletOrderFile,
  type TabletOrderItem,
  type TabletPendingTransfer,
} from "./tablet-department-panel";

type RawOrderRelation = { order_number: string };
type RawBatchRelation = {
  batch_code: string;
  order_id: string;
  order: RawOrderRelation | RawOrderRelation[] | null;
};

type RawPendingTransfer = {
  id: string;
  batch_id: string;
  quantity_sent: number;
  from_department: DepartmentCode | null;
  sent_at: string | null;
  batch: RawBatchRelation | RawBatchRelation[] | null;
};

type RawBatch = {
  id: string;
  batch_code: string;
  order_id: string;
  quantity: number;
  status: string;
  order: RawOrderRelation | RawOrderRelation[] | null;
};

type RawOrderItem = {
  order_id: string;
  product_type: string;
  fabric: string | null;
  color: string | null;
  embroidery_spec: string | null;
  size_breakdown: Record<string, unknown> | null;
  accessories: Record<string, unknown> | null;
  measurements: Record<string, unknown> | null;
  quantity: number;
  notes: string | null;
};

type RawOrderFile = {
  id: string;
  order_id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  description: string | null;
};

export default async function TabletDepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;

  if (!(department in DEPARTMENT_LABELS)) {
    redirect("/tablet");
  }

  const departmentCode = department as DepartmentCode;
  const session = await getTabletSession();

  if (!session || session.department !== departmentCode) {
    redirect(`/tablet/pin?dept=${departmentCode}`);
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: pendingTransferRows }, { data: batchRows }] = await Promise.all([
    supabase
      .from("batch_transfers")
      .select("id, batch_id, quantity_sent, from_department, sent_at, batch:batches(batch_code, order_id, order:orders(order_number))")
      .eq("to_department", departmentCode)
      .eq("status", "sent")
      .order("sent_at", { ascending: true }),
    supabase
      .from("batches")
      .select("id, batch_code, order_id, quantity, status, order:orders(order_number)")
      .eq("current_department", departmentCode)
      .neq("status", "closed")
      .order("updated_at", { ascending: false }),
  ]);

  const pendingTransferSourceRows = (pendingTransferRows ?? []) as RawPendingTransfer[];
  const batchSourceRows = (batchRows ?? []) as RawBatch[];
  const orderIds = Array.from(new Set([
    ...pendingTransferSourceRows
      .map((transfer) => singleRelation(transfer.batch)?.order_id)
      .filter((orderId): orderId is string => Boolean(orderId)),
    ...batchSourceRows.map((batch) => batch.order_id),
  ]));

  const [{ data: orderItemRows }, { data: orderFileRows }] = orderIds.length > 0
    ? await Promise.all([
        supabase
          .from("order_items")
          .select("order_id, product_type, fabric, color, embroidery_spec, size_breakdown, accessories, measurements, quantity, notes")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("order_files")
          .select("id, order_id, file_name, file_type, file_path, description")
          .in("order_id", orderIds)
          .in("file_type", ["design", "embroidery_logo"])
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const filesWithUrls = await Promise.all(
    ((orderFileRows ?? []) as RawOrderFile[]).map(async (file) => {
      const { data } = await supabase.storage
        .from("order-files")
        .createSignedUrl(file.file_path, 60 * 60);

      return {
        id: file.id,
        order_id: file.order_id,
        file_name: file.file_name,
        file_type: file.file_type,
        description: file.description,
        signed_url: data?.signedUrl ?? null,
      };
    }),
  );

  const orderItemsByOrderId = new Map<string, TabletOrderItem[]>();
  for (const item of (orderItemRows ?? []) as RawOrderItem[]) {
    const items = orderItemsByOrderId.get(item.order_id) ?? [];
    items.push({
      product_type: item.product_type,
      fabric: item.fabric,
      color: item.color,
      embroidery_spec: item.embroidery_spec,
      size_breakdown: item.size_breakdown,
      accessories: item.accessories,
      measurements: item.measurements,
      quantity: Number(item.quantity),
      notes: item.notes,
    });
    orderItemsByOrderId.set(item.order_id, items);
  }

  const orderFilesByOrderId = new Map<string, TabletOrderFile[]>();
  for (const file of filesWithUrls) {
    const files = orderFilesByOrderId.get(file.order_id) ?? [];
    files.push({
      id: file.id,
      file_name: file.file_name,
      file_type: file.file_type,
      description: file.description,
      signed_url: file.signed_url,
    });
    orderFilesByOrderId.set(file.order_id, files);
  }

  const getOrderItems = (orderId: string | null | undefined) => orderId ? orderItemsByOrderId.get(orderId) ?? [] : [];
  const getOrderFiles = (orderId: string | null | undefined) => orderId ? orderFilesByOrderId.get(orderId) ?? [] : [];

  const pendingTransfers = pendingTransferSourceRows
    .map<TabletPendingTransfer | null>((transfer) => {
      const batch = singleRelation(transfer.batch);
      const order = singleRelation(batch?.order);

      if (!batch) return null;

      return {
        id: transfer.id,
        batch_id: transfer.batch_id,
        batch_code: batch.batch_code,
        order_number: order?.order_number ?? "—",
        order_items: getOrderItems(batch.order_id),
        order_files: getOrderFiles(batch.order_id),
        quantity_sent: Number(transfer.quantity_sent),
        from_department: transfer.from_department,
        sent_at: transfer.sent_at,
      };
    })
    .filter((transfer): transfer is TabletPendingTransfer => transfer !== null);

  const batches = batchSourceRows.map<TabletBatch>((batch) => {
    const order = singleRelation(batch.order);

    return {
      id: batch.id,
      batch_code: batch.batch_code,
      order_number: order?.order_number ?? "—",
      order_items: getOrderItems(batch.order_id),
      order_files: getOrderFiles(batch.order_id),
      quantity: Number(batch.quantity),
      status: batch.status,
    };
  });

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-slate-500">واجهة التابلت</div>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              {DEPARTMENT_LABELS[departmentCode]}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              دخول: {session.fullName} · تنتهي الجلسة تلقائيًا بعد فترة عدم النشاط
            </p>
          </div>

          <form action="/api/tablet/logout" method="post">
            <button type="submit" className="btn-tablet btn-secondary text-base">
              تسجيل الخروج
            </button>
          </form>
        </header>

        <TabletDepartmentPanel
          department={departmentCode}
          batches={batches}
          pendingTransfers={pendingTransfers}
        />

        <div className="flex justify-center gap-4 text-sm">
          <Link href="/" className="text-brand-600 hover:underline">
            بوابة الدخول
          </Link>
          <Link href="/tablet" className="text-slate-500 hover:underline">
            تغيير القسم
          </Link>
        </div>
      </div>
    </main>
  );
}