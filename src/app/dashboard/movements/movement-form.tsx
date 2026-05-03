"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createMovementAction, type MovementFormState } from "./actions";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";

const MOVEMENT_LABELS: Record<string, string> = {
  extra_cut: "زيادة قص",
  shortage: "نقص",
  damaged: "تالف",
  waste: "هدر",
  free_giveaway: "تسليم مجاني",
  rework: "إعادة عمل",
};

type OrderOption = { id: string; order_number: string };
type BatchOption = { id: string; batch_code: string };

const initialState: MovementFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "تسجيل الحركة"}
    </button>
  );
}

export default function MovementForm({
  orders,
  batches,
  canCreate,
  className = "card space-y-4",
}: {
  orders: OrderOption[];
  batches: BatchOption[];
  canCreate: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(createMovementAction, initialState);
  const departments = Object.keys(DEPARTMENT_LABELS) as DepartmentCode[];

  if (!canCreate) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية لتسجيل الحركات.</div>;
  }

  if (orders.length === 0) {
    return <div className="card text-sm text-slate-600">أضف طلبًا واحدًا قبل تسجيل الحركات.</div>;
  }

  return (
    <form action={formAction} className={className}>
      <div>
        <label htmlFor="order_id" className="block text-sm font-medium text-slate-700 mb-1">
          الطلب
        </label>
        <select id="order_id" name="order_id" className="input-field" required>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.order_number}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="batch_id" className="block text-sm font-medium text-slate-700 mb-1">
          الدفعة (اختياري)
        </label>
        <select id="batch_id" name="batch_id" className="input-field">
          <option value="">بدون دفعة</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.batch_code}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">
            القسم
          </label>
          <select id="department" name="department" className="input-field" required>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {DEPARTMENT_LABELS[dept]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="movement_type" className="block text-sm font-medium text-slate-700 mb-1">
            نوع الحركة
          </label>
          <select id="movement_type" name="movement_type" className="input-field" required>
            {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">
            الكمية
          </label>
          <input id="quantity" name="quantity" type="number" min="1" className="input-field" required />
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
          السبب
        </label>
        <textarea id="reason" name="reason" className="input-field" rows={3} required />
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم تسجيل الحركة بنجاح.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
