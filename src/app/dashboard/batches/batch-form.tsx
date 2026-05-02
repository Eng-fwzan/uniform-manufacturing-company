"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBatchAction, type BatchFormState } from "./actions";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";

type OrderItemOption = {
  id: string;
  order_number: string;
  product_type: string;
  quantity: number;
  batchedQuantity: number;
  remainingQuantity: number;
};

const initialState: BatchFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "إنشاء دفعة"}
    </button>
  );
}

export default function BatchForm({
  items,
  canCreate,
  className = "card space-y-4",
}: {
  items: OrderItemOption[];
  canCreate: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(createBatchAction, initialState);
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const departments = Object.keys(DEPARTMENT_LABELS) as DepartmentCode[];
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );

  if (!canCreate) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية لإنشاء دفعة.</div>;
  }

  if (items.length === 0) {
    return <div className="card text-sm text-slate-600">لا توجد بنود بكمية متبقية لإنشاء دفعات جديدة.</div>;
  }

  return (
    <form action={formAction} className={className}>
      <div>
        <label htmlFor="order_item_id" className="block text-sm font-medium text-slate-700 mb-1">
          بند الطلب
        </label>
        <select
          id="order_item_id"
          name="order_item_id"
          className="input-field"
          value={selectedItem?.id ?? ""}
          onChange={(event) => setSelectedItemId(event.target.value)}
          required
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.order_number} · {item.product_type} · المتبقي {item.remainingQuantity} من {item.quantity}
            </option>
          ))}
        </select>
        {selectedItem && (
          <div className="mt-2 text-xs text-slate-500">
            تم إنشاء دفعات بكمية {selectedItem.batchedQuantity}، والمتبقي {selectedItem.remainingQuantity}.
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">
            كمية الدفعة
          </label>
          <input
            key={selectedItem?.id ?? "quantity"}
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            max={selectedItem?.remainingQuantity ?? undefined}
            className="input-field"
            defaultValue={selectedItem?.remainingQuantity ?? undefined}
            required
          />
        </div>
        <div>
          <label htmlFor="current_department" className="block text-sm font-medium text-slate-700 mb-1">
            القسم الحالي
          </label>
          <select id="current_department" name="current_department" className="input-field" defaultValue="cutting">
            <option value="">غير محدد</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {DEPARTMENT_LABELS[dept]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم إنشاء الدفعة بنجاح.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
