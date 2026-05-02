"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createInventoryItemAction,
  createInventoryMovementAction,
  type InventoryItemFormState,
  type InventoryMovementFormState,
} from "./actions";

const CATEGORY_LABELS = {
  fabric: "قماش",
  thread: "خيوط",
  accessory: "إكسسوارات",
  finished_good: "منتج جاهز",
  other: "أخرى",
};

const MOVEMENT_LABELS = {
  in: "وارد",
  out: "صرف",
  adjustment: "تسوية",
  reservation: "حجز",
  reservation_release: "فك حجز",
};

type InventoryItemOption = {
  id: string;
  name: string;
  color_name: string;
  color_code: string | null;
  unit: string;
  physical_balance: number;
  reserved_quantity: number;
  available_balance: number;
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function InventoryItemForm({ canAdjust }: { canAdjust: boolean }) {
  const [state, formAction] = useActionState<InventoryItemFormState, FormData>(createInventoryItemAction, {});

  if (!canAdjust) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية لإضافة أصناف المخزون.</div>;
  }

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">إضافة صنف مخزون</h2>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
          اسم الصنف
        </label>
        <input id="name" name="name" className="input-field" required />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1">
            التصنيف
          </label>
          <select id="category" name="category" className="input-field">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="unit" className="block text-sm font-medium text-slate-700 mb-1">
            الوحدة
          </label>
          <input id="unit" name="unit" className="input-field" defaultValue="قطعة" required />
        </div>
        <div>
          <label htmlFor="color_name" className="block text-sm font-medium text-slate-700 mb-1">
            اللون
          </label>
          <input id="color_name" name="color_name" className="input-field" placeholder="مثال: أزرق كحلي" defaultValue="عام" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="color_code" className="block text-sm font-medium text-slate-700 mb-1">
            رمز اللون
          </label>
          <input id="color_code" name="color_code" type="color" className="h-12 w-full rounded-lg border border-slate-300 bg-white px-2 py-1" defaultValue="#1f2937" />
        </div>
        <div>
          <label htmlFor="min_quantity" className="block text-sm font-medium text-slate-700 mb-1">
            حد التنبيه للون
          </label>
          <input id="min_quantity" name="min_quantity" type="number" min="0" step="0.01" className="input-field" defaultValue={0} />
        </div>
      </div>
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">تمت إضافة الصنف.</div>}
      <SubmitButton label="إضافة الصنف" pendingLabel="جارٍ الإضافة..." />
    </form>
  );
}

export function InventoryMovementForm({ canAdjust, items }: { canAdjust: boolean; items: InventoryItemOption[] }) {
  const [state, formAction] = useActionState<InventoryMovementFormState, FormData>(createInventoryMovementAction, {});

  if (!canAdjust) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية لتسجيل حركات المخزون.</div>;
  }

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">تسجيل حركة مخزون</h2>
      <div>
        <label htmlFor="inventory_item_id" className="block text-sm font-medium text-slate-700 mb-1">
          الصنف واللون
        </label>
        <select id="inventory_item_id" name="inventory_variant_id" className="input-field" required>
          <option value="">اختر الصنف واللون</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.color_name} · المتاح {item.available_balance.toLocaleString("ar")} {item.unit} · المحجوز {item.reserved_quantity.toLocaleString("ar")}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="movement_type" className="block text-sm font-medium text-slate-700 mb-1">
            نوع الحركة
          </label>
          <select id="movement_type" name="movement_type" className="input-field">
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
          <input id="quantity" name="quantity" type="number" min="0.01" step="0.01" className="input-field" required />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات
        </label>
        <textarea id="notes" name="notes" className="input-field" rows={2} />
      </div>
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">تم تسجيل الحركة.</div>}
      <SubmitButton label="تسجيل الحركة" pendingLabel="جارٍ التسجيل..." />
    </form>
  );
}
