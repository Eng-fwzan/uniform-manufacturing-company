"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { nextDepartment } from "@/lib/production/departments";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";
import {
  receiveTransferAction,
  recordTabletDeliveryAction,
  recordTabletQualityAction,
  recordTabletMovementAction,
  sendBatchAction,
  type TabletActionState,
} from "./actions";

export type TabletBatch = {
  id: string;
  batch_code: string;
  order_number: string;
  order_items: TabletOrderItem[];
  order_files: TabletOrderFile[];
  quantity: number;
  status: string;
};

export type TabletOrderItem = {
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

export type TabletOrderFile = {
  id: string;
  file_name: string;
  file_type: string;
  description: string | null;
  signed_url: string | null;
};

export type TabletPendingTransfer = {
  id: string;
  batch_id: string;
  batch_code: string;
  order_number: string;
  order_items: TabletOrderItem[];
  order_files: TabletOrderFile[];
  quantity_sent: number;
  from_department: DepartmentCode | null;
  sent_at: string | null;
};

const MOVEMENT_LABELS = {
  extra_cut: "زيادة قص",
  shortage: "نقص",
  damaged: "تالف",
  waste: "هدر",
  free_giveaway: "تسليم مجاني",
  rework: "إعادة عمل",
};

const STATUS_LABELS: Record<string, string> = {
  open: "مفتوحة",
  in_transit: "بانتظار الاستلام",
  received: "مستلمة",
  closed: "مغلقة",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  design: "تصميم الزي",
  embroidery_logo: "شعار التطريز",
  mockup: "نموذج التصميم",
  delivery_note: "مستند التسليم",
  invoice: "فاتورة",
  photo: "صورة",
  other: "ملف آخر",
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-tablet btn-primary w-full text-lg" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionMessage({ state }: { state: TabletActionState }) {
  if (state.error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>;
  }

  if (state.success) {
    return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{state.success}</div>;
  }

  return null;
}

function OrderReference({
  items,
  files,
}: {
  items: TabletOrderItem[];
  files: TabletOrderFile[];
}) {
  if (items.length === 0 && files.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="text-sm font-semibold text-slate-900">مرجع التصميم والتطريز</div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${item.product_type}-${index}`} className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">
              <div className="font-medium text-slate-900">
                {item.product_type} · {item.quantity} قطعة
              </div>
              <div className="mt-1 text-slate-600">
                {item.fabric ?? "قماش غير محدد"} / {item.color ?? "لون غير محدد"}
              </div>
              {item.embroidery_spec && <div className="mt-1">التطريز: {item.embroidery_spec}</div>}
              {formatJsonSummary(item.size_breakdown) !== "—" && <div className="mt-1">المقاسات: {formatJsonSummary(item.size_breakdown)}</div>}
              {formatJsonSummary(item.accessories) !== "—" && <div className="mt-1">التوابع: {formatJsonSummary(item.accessories)}</div>}
              {formatJsonSummary(item.measurements) !== "—" && <div className="mt-1">القياسات: {formatJsonSummary(item.measurements)}</div>}
              {item.notes && <div className="mt-1">ملاحظة: {item.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="grid gap-3">
          {files.map((file) => (
            <div key={file.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{FILE_TYPE_LABELS[file.file_type] ?? file.file_type}</div>
                  <div className="mt-1 truncate text-xs text-slate-500" dir="ltr">{file.file_name}</div>
                </div>
                <a
                  href={`/tablet/files/${file.id}/download`}
                  download={file.file_name}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-slate-800"
                >
                  تنزيل للجهاز
                </a>
              </div>
              {file.signed_url && isVisualOrderFile(file) && (
                <a href={file.signed_url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <Image
                    src={file.signed_url}
                    alt={file.file_name}
                    width={720}
                    height={360}
                    unoptimized
                    className="h-60 w-full object-contain p-2"
                  />
                </a>
              )}
              {file.signed_url && (
                <a href={file.signed_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-slate-50">
                  {isVisualOrderFile(file) ? "فتح الصورة" : "فتح الملف"}
                </a>
              )}
              {file.description && <div className="mt-2 leading-6">{file.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiveTransferCard({
  department,
  transfer,
}: {
  department: DepartmentCode;
  transfer: TabletPendingTransfer;
}) {
  const [state, formAction] = useActionState<TabletActionState, FormData>(receiveTransferAction, {});

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <input type="hidden" name="department" value={department} />
      <input type="hidden" name="transfer_id" value={transfer.id} />

      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="text-xl font-bold text-slate-900" dir="ltr">{transfer.batch_code}</div>
          <div className="mt-1 text-sm text-slate-600">
            الطلب {transfer.order_number} · من {transfer.from_department ? DEPARTMENT_LABELS[transfer.from_department] : "البداية"}
          </div>
        </div>
        <div className="rounded-lg bg-slate-100 px-4 py-2 text-center text-sm text-slate-700">
          المرسل: {transfer.quantity_sent}
        </div>
      </div>

      <OrderReference items={transfer.order_items} files={transfer.order_files} />

      <div>
        <label htmlFor={`quantity_received_${transfer.id}`} className="block text-sm font-medium text-slate-700 mb-1">
          الكمية المستلمة
        </label>
        <input
          id={`quantity_received_${transfer.id}`}
          name="quantity_received"
          type="number"
          min="1"
          className="input-field text-lg"
          defaultValue={transfer.quantity_sent}
          required
        />
      </div>

      <ActionMessage state={state} />
      <SubmitButton label="تأكيد الاستلام" pendingLabel="جارٍ الاستلام..." />
    </form>
  );
}

function BatchCard({ department, batch }: { department: DepartmentCode; batch: TabletBatch }) {
  const [state, formAction] = useActionState<TabletActionState, FormData>(sendBatchAction, {});
  const targetDepartment = nextDepartment(department);
  const isWaitingReceive = batch.status === "in_transit";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <div className="text-xl font-bold text-slate-900" dir="ltr">{batch.batch_code}</div>
          <div className="mt-1 text-sm text-slate-600">الطلب {batch.order_number}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{batch.quantity} قطعة</span>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{STATUS_LABELS[batch.status] ?? batch.status}</span>
        </div>
      </div>

      <OrderReference items={batch.order_items} files={batch.order_files} />

      {isWaitingReceive ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          هذه الدفعة وصلت لهذا القسم وتحتاج تأكيد الاستلام من قائمة التحويلات.
        </div>
      ) : department === "delivery" ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          سجل التسليم من نموذج التسليم النهائي لإغلاق الدفعة رسميًا.
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="department" value={department} />
          <input type="hidden" name="batch_id" value={batch.id} />

          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <div>
              <label htmlFor={`quantity_sent_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                الكمية
              </label>
              <input
                id={`quantity_sent_${batch.id}`}
                name="quantity_sent"
                type="number"
                min="1"
                max={batch.quantity}
                className="input-field text-lg"
                defaultValue={batch.quantity}
                required
              />
            </div>
            <div>
              <label htmlFor={`notes_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                ملاحظات
              </label>
              <input id={`notes_${batch.id}`} name="notes" className="input-field text-lg" />
            </div>
          </div>

          <ActionMessage state={state} />
          <SubmitButton
            label={targetDepartment ? `إرسال إلى ${DEPARTMENT_LABELS[targetDepartment]}` : "إغلاق بعد التسليم"}
            pendingLabel="جارٍ التنفيذ..."
          />
        </form>
      )}
    </div>
  );
}

function QualityCheckCard({ batch }: { batch: TabletBatch }) {
  const [state, formAction] = useActionState<TabletActionState, FormData>(recordTabletQualityAction, {});

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <input type="hidden" name="department" value="quality" />
      <input type="hidden" name="batch_id" value={batch.id} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-bold text-slate-900" dir="ltr">{batch.batch_code}</div>
          <div className="mt-1 text-sm text-slate-600">الطلب {batch.order_number}</div>
        </div>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{batch.quantity} قطعة</span>
      </div>

      <OrderReference items={batch.order_items} files={batch.order_files} />

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor={`quality_result_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
            النتيجة
          </label>
          <select id={`quality_result_${batch.id}`} name="result" className="input-field text-lg" required>
            <option value="passed">ناجح</option>
            <option value="failed">مرفوض</option>
            <option value="rework">إعادة عمل</option>
          </select>
        </div>
        <div>
          <label htmlFor={`checked_quantity_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
            المفحوص
          </label>
          <input id={`checked_quantity_${batch.id}`} name="checked_quantity" type="number" min="1" max={batch.quantity} className="input-field text-lg" defaultValue={batch.quantity} required />
        </div>
        <div>
          <label htmlFor={`failed_quantity_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
            الرفض/الإعادة
          </label>
          <input id={`failed_quantity_${batch.id}`} name="failed_quantity" type="number" min="0" max={batch.quantity} className="input-field text-lg" defaultValue={0} />
        </div>
      </div>

      <div>
        <label htmlFor={`quality_notes_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات
        </label>
        <textarea id={`quality_notes_${batch.id}`} name="notes" className="input-field text-lg" rows={2} />
      </div>

      <ActionMessage state={state} />
      <SubmitButton label="تسجيل نتيجة الجودة" pendingLabel="جارٍ الحفظ..." />
    </form>
  );
}

function QualityCheckSection({ batches }: { batches: TabletBatch[] }) {
  const availableBatches = batches.filter((batch) => batch.status !== "in_transit");

  if (availableBatches.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
        لا توجد دفعة مستلمة في الجودة لتسجيل الفحص.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">فحص الجودة</h2>
        <span className="rounded-lg bg-slate-200 px-3 py-1 text-sm text-slate-700">{availableBatches.length}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {availableBatches.map((batch) => (
          <QualityCheckCard key={batch.id} batch={batch} />
        ))}
      </div>
    </section>
  );
}

function DeliveryRecordCard({ batch }: { batch: TabletBatch }) {
  const [state, formAction] = useActionState<TabletActionState, FormData>(recordTabletDeliveryAction, {});

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <input type="hidden" name="department" value="delivery" />
      <input type="hidden" name="batch_id" value={batch.id} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-bold text-slate-900" dir="ltr">{batch.batch_code}</div>
          <div className="mt-1 text-sm text-slate-600">الطلب {batch.order_number}</div>
        </div>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{batch.quantity} قطعة</span>
      </div>

      <OrderReference items={batch.order_items} files={batch.order_files} />

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor={`delivered_quantity_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
            الكمية
          </label>
          <input id={`delivered_quantity_${batch.id}`} name="delivered_quantity" type="number" min="1" max={batch.quantity} className="input-field text-lg" defaultValue={batch.quantity} required />
        </div>
        <div>
          <label htmlFor={`recipient_name_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
            المستلم
          </label>
          <input id={`recipient_name_${batch.id}`} name="recipient_name" className="input-field text-lg" required />
        </div>
        <div>
          <label htmlFor={`recipient_phone_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
            الهاتف
          </label>
          <input id={`recipient_phone_${batch.id}`} name="recipient_phone" className="input-field text-lg" dir="ltr" />
        </div>
      </div>

      <div>
        <label htmlFor={`delivery_notes_${batch.id}`} className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات
        </label>
        <textarea id={`delivery_notes_${batch.id}`} name="notes" className="input-field text-lg" rows={2} />
      </div>

      <ActionMessage state={state} />
      <SubmitButton label="تسجيل التسليم وإغلاق الدفعة" pendingLabel="جارٍ التسجيل..." />
    </form>
  );
}

function DeliveryRecordSection({ batches }: { batches: TabletBatch[] }) {
  const availableBatches = batches.filter((batch) => batch.status !== "in_transit");

  if (availableBatches.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
        لا توجد دفعة مستلمة في التسليم لإغلاقها.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">التسليم النهائي</h2>
        <span className="rounded-lg bg-slate-200 px-3 py-1 text-sm text-slate-700">{availableBatches.length}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {availableBatches.map((batch) => (
          <DeliveryRecordCard key={batch.id} batch={batch} />
        ))}
      </div>
    </section>
  );
}

function MovementForm({ department, batches }: { department: DepartmentCode; batches: TabletBatch[] }) {
  const [state, formAction] = useActionState<TabletActionState, FormData>(recordTabletMovementAction, {});
  const availableBatches = batches.filter((batch) => batch.status !== "in_transit");

  if (availableBatches.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
        لا توجد دفعة مستلمة في القسم لتسجيل حركة كمية.
      </section>
    );
  }

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <input type="hidden" name="department" value={department} />
      <h2 className="text-xl font-bold text-slate-900">تسجيل فرق كمية</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="batch_id" className="block text-sm font-medium text-slate-700 mb-1">
            الدفعة
          </label>
          <select id="batch_id" name="batch_id" className="input-field text-lg" required>
            {availableBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_code} · {batch.order_number}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="movement_type" className="block text-sm font-medium text-slate-700 mb-1">
            النوع
          </label>
          <select id="movement_type" name="movement_type" className="input-field text-lg" required>
            {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">
            الكمية
          </label>
          <input id="quantity" name="quantity" type="number" min="1" className="input-field text-lg" required />
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
          السبب
        </label>
        <textarea id="reason" name="reason" className="input-field text-lg" rows={2} required />
      </div>

      <ActionMessage state={state} />
      <SubmitButton label="تسجيل الحركة" pendingLabel="جارٍ التسجيل..." />
    </form>
  );
}

function formatJsonSummary(value: Record<string, unknown> | null) {
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

function isVisualOrderFile(file: TabletOrderFile) {
  return (
    ["design", "embroidery_logo", "mockup", "photo"].includes(file.file_type) ||
    /\.(png|jpe?g|webp|gif)$/i.test(file.file_name)
  );
}

export default function TabletDepartmentPanel({
  department,
  batches,
  pendingTransfers,
}: {
  department: DepartmentCode;
  batches: TabletBatch[];
  pendingTransfers: TabletPendingTransfer[];
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">تحويلات بانتظار الاستلام</h2>
          <span className="rounded-lg bg-slate-200 px-3 py-1 text-sm text-slate-700">{pendingTransfers.length}</span>
        </div>
        {pendingTransfers.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            لا توجد تحويلات تنتظر الاستلام.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingTransfers.map((transfer) => (
              <ReceiveTransferCard key={transfer.id} department={department} transfer={transfer} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">دفعات القسم</h2>
          <span className="rounded-lg bg-slate-200 px-3 py-1 text-sm text-slate-700">{batches.length}</span>
        </div>
        {batches.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            لا توجد دفعات في هذا القسم حاليًا.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {batches.map((batch) => (
              <BatchCard key={batch.id} department={department} batch={batch} />
            ))}
          </div>
        )}
      </section>

      {department === "quality" && <QualityCheckSection batches={batches} />}
      {department === "delivery" && <DeliveryRecordSection batches={batches} />}

      <MovementForm department={department} batches={batches} />
    </div>
  );
}
