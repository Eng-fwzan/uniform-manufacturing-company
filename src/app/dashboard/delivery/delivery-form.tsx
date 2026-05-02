"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { recordDeliveryAction, type DeliveryFormState } from "./actions";

type BatchOption = {
  id: string;
  batch_code: string;
  order_number: string;
  quantity: number;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ التسجيل..." : "تسجيل التسليم وإغلاق الدفعة"}
    </button>
  );
}

export default function DeliveryForm({ batches, canDeliver }: { batches: BatchOption[]; canDeliver: boolean }) {
  const [state, formAction] = useActionState<DeliveryFormState, FormData>(recordDeliveryAction, {});
  const firstBatchQuantity = batches[0]?.quantity ?? 1;

  if (!canDeliver) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية تسجيل التسليم.</div>;
  }

  if (batches.length === 0) {
    return <div className="card text-sm text-slate-600">لا توجد دفعات في قسم التسليم حاليًا.</div>;
  }

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">تسجيل تسليم نهائي</h2>

      <div>
        <label htmlFor="batch_id" className="block text-sm font-medium text-slate-700 mb-1">
          الدفعة
        </label>
        <select id="batch_id" name="batch_id" className="input-field" required>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.batch_code} · {batch.order_number} · {batch.quantity}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="delivered_quantity" className="block text-sm font-medium text-slate-700 mb-1">
            كمية التسليم
          </label>
          <input id="delivered_quantity" name="delivered_quantity" type="number" min="1" className="input-field" defaultValue={firstBatchQuantity} required />
        </div>
        <div>
          <label htmlFor="recipient_name" className="block text-sm font-medium text-slate-700 mb-1">
            اسم المستلم
          </label>
          <input id="recipient_name" name="recipient_name" className="input-field" required />
        </div>
        <div>
          <label htmlFor="recipient_phone" className="block text-sm font-medium text-slate-700 mb-1">
            هاتف المستلم
          </label>
          <input id="recipient_phone" name="recipient_phone" className="input-field" dir="ltr" />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات التسليم
        </label>
        <textarea id="notes" name="notes" className="input-field" rows={3} />
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم تسجيل التسليم وإغلاق الدفعة.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}