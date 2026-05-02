"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  archiveOrderAction,
  deleteOrderFileAction,
  duplicateArchivedOrderAction,
  saveChecklistAction,
  uploadOrderFileAction,
  type ArchiveActionState,
} from "./actions";

export type ArchiveOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  track: string;
  due_date: string | null;
  created_at: string | null;
  item_summary: string;
  notes: string | null;
};

export type ChecklistItem = {
  order_id: string;
  item_key: string;
  label: string;
  is_done: boolean;
};

export type OrderFile = {
  id: string;
  order_id: string;
  file_name: string;
  file_type: string;
  description: string | null;
  created_at: string | null;
  signed_url: string | null;
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

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  archived: "مؤرشف",
  cancelled: "ملغي",
};

const TRACK_LABELS: Record<string, string> = {
  production: "إنتاج",
  sample: "عينة",
  modification: "تعديل",
};

function SubmitButton({
  label,
  pendingLabel,
  className = "btn-tablet btn-primary w-full",
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionMessage({ state }: { state: ArchiveActionState }) {
  if (state.error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>;
  }

  if (state.success) {
    return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{state.success}</div>;
  }

  return null;
}

export default function ArchivePanel({
  orders,
  checklist,
  files,
}: {
  orders: ArchiveOrder[];
  checklist: ChecklistItem[];
  files: OrderFile[];
}) {
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const [checklistState, checklistAction] = useActionState(saveChecklistAction, {});
  const [fileState, fileAction] = useActionState(uploadOrderFileAction, {});
  const [archiveState, archiveAction] = useActionState(archiveOrderAction, {});
  const [duplicateState, duplicateAction] = useActionState(duplicateArchivedOrderAction, {});

  const filteredOrders = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return orders;

    return orders.filter((order) =>
      [
        order.order_number,
        order.customer_name,
        order.item_summary,
        STATUS_LABELS[order.status] ?? order.status,
        TRACK_LABELS[order.track] ?? order.track,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(value)),
    );
  }, [orders, search]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null;
  const selectedChecklist = selectedOrder ? checklist.filter((item) => item.order_id === selectedOrder.id) : [];
  const selectedFiles = selectedOrder ? files.filter((file) => file.order_id === selectedOrder.id) : [];
  const completedChecklist = selectedChecklist.filter((item) => item.is_done).length;

  if (orders.length === 0) {
    return <div className="card text-sm text-slate-600">لا توجد طلبات للأرشفة بعد.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="card h-fit space-y-4">
        <div>
          <label htmlFor="archive_search" className="block text-sm font-medium text-slate-700 mb-1">
            بحث في الأرشيف
          </label>
          <input
            id="archive_search"
            className="input-field"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="رقم الطلب، العميل، القطعة"
          />
        </div>

        <div className="max-h-[32rem] space-y-2 overflow-auto pl-1">
          {filteredOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              لا توجد نتائج مطابقة.
            </div>
          ) : (
            filteredOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedOrderId(order.id)}
                className={`w-full rounded-lg border px-4 py-3 text-right transition-colors ${
                  selectedOrder?.id === order.id
                    ? "border-brand-500 bg-brand-50 text-brand-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="font-semibold" dir="ltr">{order.order_number}</div>
                <div className="mt-1 text-sm">{order.customer_name}</div>
                <div className="mt-1 text-xs text-slate-500">{STATUS_LABELS[order.status] ?? order.status}</div>
              </button>
            ))
          )}
        </div>
      </aside>

      {selectedOrder ? (
        <section className="space-y-6">
          <div className="card space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm text-slate-500">ملف الطلب</div>
                <h2 className="mt-1 text-2xl font-bold text-slate-900" dir="ltr">{selectedOrder.order_number}</h2>
                <p className="mt-2 text-slate-600">
                  {selectedOrder.customer_name} · {TRACK_LABELS[selectedOrder.track] ?? selectedOrder.track}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryBox label="الحالة" value={STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status} />
                <SummaryBox label="عناصر الأرشفة" value={`${completedChecklist} / ${selectedChecklist.length}`} />
                <SummaryBox label="الملفات" value={`${selectedFiles.length}`} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <InfoLine label="البند" value={selectedOrder.item_summary || "—"} />
              <InfoLine label="التسليم" value={selectedOrder.due_date ?? "—"} dir="ltr" />
              <InfoLine label="الإنشاء" value={selectedOrder.created_at?.slice(0, 10) ?? "—"} dir="ltr" />
            </div>
            {selectedOrder.notes && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{selectedOrder.notes}</div>}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">قائمة إغلاق الأرشيف</h3>
              <form key={selectedOrder.id} action={checklistAction} className="space-y-4">
                <input type="hidden" name="order_id" value={selectedOrder.id} />
                <div className="space-y-3">
                  {selectedChecklist.map((item) => (
                    <label key={item.item_key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name={`item_${item.item_key}`}
                        defaultChecked={item.is_done}
                        className="h-4 w-4"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
                <ActionMessage state={checklistState} />
                <SubmitButton label="حفظ قائمة الأرشفة" pendingLabel="جارٍ الحفظ..." />
              </form>

              <div className="grid gap-3 md:grid-cols-2">
                <form action={archiveAction} className="space-y-3">
                  <input type="hidden" name="order_id" value={selectedOrder.id} />
                  <ActionMessage state={archiveState} />
                  <SubmitButton label="إغلاق في الأرشيف" pendingLabel="جارٍ الأرشفة..." className="btn-tablet btn-secondary w-full" />
                </form>
                <form action={duplicateAction} className="space-y-3">
                  <input type="hidden" name="order_id" value={selectedOrder.id} />
                  <ActionMessage state={duplicateState} />
                  <SubmitButton label="ترحيل نسخة للطلبات" pendingLabel="جارٍ الترحيل..." className="btn-tablet btn-primary w-full" />
                </form>
              </div>
            </div>

            <div className="card space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">رفع ملف للأرشيف</h3>
              <form key={`file-${selectedOrder.id}`} action={fileAction} className="space-y-4">
                <input type="hidden" name="order_id" value={selectedOrder.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="file_type" className="block text-sm font-medium text-slate-700 mb-1">نوع الملف</label>
                    <select id="file_type" name="file_type" className="input-field" required>
                      {Object.entries(FILE_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="file_name" className="block text-sm font-medium text-slate-700 mb-1">اسم الملف</label>
                    <input id="file_name" name="file_name" className="input-field" placeholder="يظهر في قائمة الملفات" />
                  </div>
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">تفاصيل الملف</label>
                  <textarea id="description" name="description" className="input-field" rows={2} placeholder="تفاصيل التصميم، سند التسليم، أو ملاحظات الاعتماد" />
                </div>
                <div>
                  <label htmlFor="file" className="block text-sm font-medium text-slate-700 mb-1">الملف</label>
                  <input id="file" name="file" type="file" className="input-field" required />
                </div>
                <ActionMessage state={fileState} />
                <SubmitButton label="رفع الملف" pendingLabel="جارٍ الرفع..." className="btn-tablet btn-secondary w-full" />
              </form>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">ملفات الطلب</h3>
            {selectedFiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                لا توجد ملفات لهذا الطلب بعد.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{file.file_name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {FILE_TYPE_LABELS[file.file_type] ?? file.file_type} · {file.created_at?.slice(0, 10) ?? "—"}
                        </div>
                      </div>
                      <form action={deleteOrderFileAction}>
                        <input type="hidden" name="file_id" value={file.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">حذف</button>
                      </form>
                    </div>
                    {file.signed_url && isVisualFile(file.file_type) && (
                      <a href={file.signed_url} target="_blank" rel="noreferrer" className="mt-3 block">
                        <img src={file.signed_url} alt={file.file_name} className="h-40 w-full rounded-lg border border-slate-200 bg-white object-cover" />
                      </a>
                    )}
                    {file.description && <div className="mt-3 text-sm leading-6 text-slate-700">{file.description}</div>}
                    {file.signed_url && (
                      <a href={file.signed_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
                        فتح الملف
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="card text-sm text-slate-600">اختر طلبًا من القائمة.</div>
      )}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function InfoLine({ label, value, dir }: { label: string; value: string; dir?: "rtl" | "ltr" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-900" dir={dir}>{value}</div>
    </div>
  );
}

function isVisualFile(fileType: string) {
  return ["design", "embroidery_logo", "mockup", "photo"].includes(fileType);
}