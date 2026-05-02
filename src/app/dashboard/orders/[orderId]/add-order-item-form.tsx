"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addOrderItemAction, type OrderItemFormState } from "../actions";

type FabricVariantOption = {
  id: string;
  name: string;
  color_name: string;
  unit: string;
  balance: number;
};

const initialState: OrderItemFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ إضافة البند..." : "إضافة بند للطلب"}
    </button>
  );
}

export default function AddOrderItemForm({
  canAdd,
  orderId,
  fabricVariants,
}: {
  canAdd: boolean;
  orderId: string;
  fabricVariants: FabricVariantOption[];
}) {
  const [state, formAction] = useActionState(addOrderItemAction, initialState);

  if (!canAdd) {
    return <div className="text-sm text-slate-600">لا يمكن إضافة بنود لهذا الطلب في حالته الحالية.</div>;
  }

  if (fabricVariants.length === 0) {
    return <div className="text-sm text-slate-600">لا يوجد قماش متاح في المخزون لإضافة بند جديد.</div>;
  }

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
      <input type="hidden" name="order_id" value={orderId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="new_product_type" className="block text-sm font-medium text-slate-700 mb-1">
            نوع القطعة
          </label>
          <input id="new_product_type" name="product_type" className="input-field" placeholder="قميص / بنطال / جاكيت" required />
        </div>
        <div>
          <label htmlFor="new_quantity" className="block text-sm font-medium text-slate-700 mb-1">
            الكمية
          </label>
          <input id="new_quantity" name="quantity" type="number" min="1" className="input-field" required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="new_inventory_variant_id" className="block text-sm font-medium text-slate-700 mb-1">
            القماش واللون
          </label>
          <select id="new_inventory_variant_id" name="inventory_variant_id" className="input-field" required>
            {fabricVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} · {variant.color_name} · المتاح {variant.balance.toLocaleString("ar")} {variant.unit}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new_fabric_consumption" className="block text-sm font-medium text-slate-700 mb-1">
            كمية القماش المحجوزة
          </label>
          <input id="new_fabric_consumption" name="fabric_consumption" type="number" min="0.01" step="0.01" className="input-field" required />
        </div>
        <div>
          <label htmlFor="new_embroidery_spec" className="block text-sm font-medium text-slate-700 mb-1">
            التطريز
          </label>
          <input id="new_embroidery_spec" name="embroidery_spec" className="input-field" />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">المقاسات</h3>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["size_s", "S"],
            ["size_m", "M"],
            ["size_l", "L"],
            ["size_xl", "XL"],
          ].map(([name, label]) => (
            <div key={name}>
              <label htmlFor={`new_${name}`} className="block text-sm font-medium text-slate-700 mb-1">
                {label}
              </label>
              <input id={`new_${name}`} name={name} type="number" min="0" className="input-field" defaultValue={0} />
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="new_size_custom" className="block text-sm font-medium text-slate-700 mb-1">
            مقاسات خاصة / تفصيل
          </label>
          <textarea id="new_size_custom" name="size_custom" className="input-field" rows={2} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">توابع وملاحظات</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <input name="accessory_buttons" className="input-field" placeholder="الأزرار" />
          <input name="accessory_zipper" className="input-field" placeholder="السحاب/السستة" />
          <input name="accessory_badge" className="input-field" placeholder="الشعار/البادج" />
        </div>
        <textarea name="accessory_notes" className="input-field" rows={2} placeholder="ملاحظات التوابع" />
        <textarea name="measurements_notes" className="input-field" rows={2} placeholder="ملاحظات القياسات" />
        <textarea name="item_notes" className="input-field" rows={2} placeholder="ملاحظات البند" />
      </section>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تمت إضافة البند وحجز القماش بنجاح.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}