"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { recordQualityAction, type QualityFormState } from "./actions";

type BatchOption = {
  id: string;
  batch_code: string;
  order_number: string;
  quantity: number;
};

const RESULT_LABELS = {
  passed: "ناجح",
  failed: "مرفوض",
  rework: "إعادة عمل",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "تسجيل نتيجة الجودة"}
    </button>
  );
}

export default function QualityForm({ batches, canRecord }: { batches: BatchOption[]; canRecord: boolean }) {
  const [state, formAction] = useActionState<QualityFormState, FormData>(recordQualityAction, {});
  const firstBatchQuantity = batches[0]?.quantity ?? 1;

  if (!canRecord) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية تسجيل نتيجة الجودة.</div>;
  }

  if (batches.length === 0) {
    return <div className="card text-sm text-slate-600">لا توجد دفعات في قسم الجودة حاليًا.</div>;
  }

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">تسجيل فحص جودة</h2>

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
          <label htmlFor="result" className="block text-sm font-medium text-slate-700 mb-1">
            النتيجة
          </label>
          <select id="result" name="result" className="input-field" required>
            {Object.entries(RESULT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="checked_quantity" className="block text-sm font-medium text-slate-700 mb-1">
            كمية الفحص
          </label>
          <input id="checked_quantity" name="checked_quantity" type="number" min="1" className="input-field" defaultValue={firstBatchQuantity} required />
        </div>
        <div>
          <label htmlFor="failed_quantity" className="block text-sm font-medium text-slate-700 mb-1">
            كمية الرفض/الإعادة
          </label>
          <input id="failed_quantity" name="failed_quantity" type="number" min="0" className="input-field" defaultValue={0} />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات الجودة
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
          تم تسجيل نتيجة الجودة.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}