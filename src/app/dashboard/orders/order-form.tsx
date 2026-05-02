"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createOrderAction, type OrderFormState } from "./actions";

type CustomerOption = { id: string; name: string };

type FabricVariantOption = {
  id: string;
  name: string;
  color_name: string;
  unit: string;
  balance: number;
};

const initialState: OrderFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "إنشاء الطلب"}
    </button>
  );
}

export default function OrderForm({
  canCreate,
  customers,
  fabricVariants,
}: {
  canCreate: boolean;
  customers: CustomerOption[];
  fabricVariants: FabricVariantOption[];
}) {
  const [state, formAction] = useActionState(createOrderAction, initialState);

  if (!canCreate) {
    return (
      <div className="card text-sm text-slate-600">
        ليس لديك صلاحية لإنشاء طلب جديد.
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="card text-sm text-slate-600">
        يجب إضافة عميل واحد على الأقل قبل إنشاء الطلبات.
      </div>
    );
  }

  if (fabricVariants.length === 0) {
    return (
      <div className="card text-sm text-slate-600">
        سجل قماشًا واحدًا على الأقل في المخزون مع اللون والرصيد قبل إنشاء الطلبات.
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <label htmlFor="customer_id" className="block text-sm font-medium text-slate-700 mb-1">
          العميل
        </label>
        <select id="customer_id" name="customer_id" className="input-field" required>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="track" className="block text-sm font-medium text-slate-700 mb-1">
            المسار
          </label>
          <select id="track" name="track" className="input-field">
            <option value="production">إنتاج</option>
            <option value="sample">عينة</option>
            <option value="modification">تعديل</option>
          </select>
        </div>
        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-slate-700 mb-1">
            تاريخ التسليم
          </label>
          <input id="due_date" name="due_date" type="date" className="input-field" />
        </div>
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">
            الكمية
          </label>
          <input id="quantity" name="quantity" type="number" min="1" className="input-field" required />
        </div>
      </div>

      <div>
        <label htmlFor="product_type" className="block text-sm font-medium text-slate-700 mb-1">
          نوع القطعة
        </label>
        <input id="product_type" name="product_type" className="input-field" placeholder="قميص / بنطال / جاكيت" required />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="inventory_variant_id" className="block text-sm font-medium text-slate-700 mb-1">
            القماش واللون من المخزون
          </label>
          <select id="inventory_variant_id" name="inventory_variant_id" className="input-field" required>
            {fabricVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} · {variant.color_name} · المتاح {variant.balance.toLocaleString("ar")} {variant.unit}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fabric_consumption" className="block text-sm font-medium text-slate-700 mb-1">
            كمية القماش المحجوزة
          </label>
          <input id="fabric_consumption" name="fabric_consumption" type="number" min="0.01" step="0.01" className="input-field" required />
        </div>
        <div>
          <label htmlFor="embroidery_spec" className="block text-sm font-medium text-slate-700 mb-1">
            التطريز
          </label>
          <input id="embroidery_spec" name="embroidery_spec" className="input-field" />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">تفاصيل المقاسات</h3>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["size_s", "S"],
            ["size_m", "M"],
            ["size_l", "L"],
            ["size_xl", "XL"],
          ].map(([name, label]) => (
            <div key={name}>
              <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">
                {label}
              </label>
              <input id={name} name={name} type="number" min="0" className="input-field" defaultValue={0} />
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="size_custom" className="block text-sm font-medium text-slate-700 mb-1">
            مقاسات خاصة / تفصيل
          </label>
          <textarea id="size_custom" name="size_custom" className="input-field" rows={2} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">توابع القطعة</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="accessory_buttons" className="block text-sm font-medium text-slate-700 mb-1">
              الأزرار
            </label>
            <input id="accessory_buttons" name="accessory_buttons" className="input-field" />
          </div>
          <div>
            <label htmlFor="accessory_zipper" className="block text-sm font-medium text-slate-700 mb-1">
              السحاب/السستة
            </label>
            <input id="accessory_zipper" name="accessory_zipper" className="input-field" />
          </div>
          <div>
            <label htmlFor="accessory_badge" className="block text-sm font-medium text-slate-700 mb-1">
              الشعار/البادج
            </label>
            <input id="accessory_badge" name="accessory_badge" className="input-field" />
          </div>
        </div>
        <div>
          <label htmlFor="accessory_notes" className="block text-sm font-medium text-slate-700 mb-1">
            ملاحظات التوابع
          </label>
          <textarea id="accessory_notes" name="accessory_notes" className="input-field" rows={2} />
        </div>
      </section>

      <div>
        <label htmlFor="measurements_notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات القياسات
        </label>
        <textarea id="measurements_notes" name="measurements_notes" className="input-field" rows={2} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">صور التصميم والتطريز</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label htmlFor="design_file" className="block text-sm font-medium text-slate-700 mb-1">
                صورة تصميم الزي
              </label>
              <input id="design_file" name="design_file" type="file" accept="image/*" className="input-field" />
            </div>
            <div>
              <label htmlFor="design_description" className="block text-sm font-medium text-slate-700 mb-1">
                تفاصيل التصميم
              </label>
              <textarea id="design_description" name="design_description" className="input-field" rows={3} placeholder="الألوان، أماكن الجيوب، القصّة، أو أي اعتماد خاص" />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="embroidery_logo_file" className="block text-sm font-medium text-slate-700 mb-1">
                صورة شعار التطريز
              </label>
              <input id="embroidery_logo_file" name="embroidery_logo_file" type="file" accept="image/*" className="input-field" />
            </div>
            <div>
              <label htmlFor="embroidery_logo_description" className="block text-sm font-medium text-slate-700 mb-1">
                تفاصيل الشعار والتطريز
              </label>
              <textarea id="embroidery_logo_description" name="embroidery_logo_description" className="input-field" rows={3} placeholder="الموضع، المقاس، ألوان الخيط، أو طريقة التنفيذ" />
            </div>
          </div>
        </div>
      </section>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات الطلب
        </label>
        <textarea id="notes" name="notes" className="input-field" rows={3} />
      </div>

      <div>
        <label htmlFor="item_notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات البند
        </label>
        <textarea id="item_notes" name="item_notes" className="input-field" rows={3} />
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم إنشاء الطلب بنجاح.
        </div>
      )}

      {state?.warning && !state.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.warning}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
