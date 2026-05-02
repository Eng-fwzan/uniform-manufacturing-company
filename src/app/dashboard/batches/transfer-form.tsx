"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createTransferAction, type TransferFormState } from "./actions";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";

type BatchOption = {
  id: string;
  batch_code: string;
  order_number: string;
  quantity: number;
  current_department: DepartmentCode | null;
  status: string;
};

const initialState: TransferFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-secondary w-full" disabled={pending}>
      {pending ? "جارٍ الإرسال..." : "إرسال الدفعة"}
    </button>
  );
}

export default function TransferForm({
  batches,
  canTransfer,
  className = "card space-y-4",
}: {
  batches: BatchOption[];
  canTransfer: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(createTransferAction, initialState);
  const [selectedBatchId, setSelectedBatchId] = useState(batches[0]?.id ?? "");
  const departments = Object.keys(DEPARTMENT_LABELS) as DepartmentCode[];
  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) ?? batches[0] ?? null,
    [batches, selectedBatchId],
  );
  const targetDepartments = selectedBatch?.current_department
    ? departments.filter((dept) => dept !== selectedBatch.current_department)
    : departments;

  if (!canTransfer) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية لتحويل الدفعات.</div>;
  }

  if (batches.length === 0) {
    return <div className="card text-sm text-slate-600">لا توجد دفعات جاهزة للتحويل.</div>;
  }

  return (
    <form action={formAction} className={className}>
      <div>
        <label htmlFor="batch_id" className="block text-sm font-medium text-slate-700 mb-1">
          الدفعة
        </label>
        <select
          id="batch_id"
          name="batch_id"
          className="input-field"
          value={selectedBatch?.id ?? ""}
          onChange={(event) => setSelectedBatchId(event.target.value)}
          required
        >
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.batch_code} · {batch.order_number} · {batch.quantity}
            </option>
          ))}
        </select>
        {selectedBatch && (
          <div className="mt-2 text-xs text-slate-500">
            القسم الحالي: {selectedBatch.current_department ? DEPARTMENT_LABELS[selectedBatch.current_department] : "غير محدد"}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            من قسم
          </label>
          <input type="hidden" name="from_department" value={selectedBatch?.current_department ?? ""} />
          <div className="input-field bg-slate-100 text-slate-700">
            {selectedBatch?.current_department ? DEPARTMENT_LABELS[selectedBatch.current_department] : "من البداية"}
          </div>
        </div>
        <div>
          <label htmlFor="to_department" className="block text-sm font-medium text-slate-700 mb-1">
            إلى قسم
          </label>
          <select key={selectedBatch?.id ?? "to_department"} id="to_department" name="to_department" className="input-field" required>
            {targetDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {DEPARTMENT_LABELS[dept]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="quantity_sent" className="block text-sm font-medium text-slate-700 mb-1">
          الكمية المُرسلة
        </label>
        <input
          key={selectedBatch?.id ?? "quantity_sent"}
          id="quantity_sent"
          name="quantity_sent"
          type="number"
          min="1"
          max={selectedBatch?.quantity ?? undefined}
          className="input-field"
          defaultValue={selectedBatch?.quantity ?? undefined}
          required
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات
        </label>
        <textarea id="notes" name="notes" className="input-field" rows={2} />
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم إرسال الدفعة بنجاح.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
