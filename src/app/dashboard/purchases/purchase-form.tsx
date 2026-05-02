"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPurchaseRequestAction, type PurchaseFormState } from "./actions";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";

const CATEGORY_LABELS = {
  fabric: "قماش",
  thread: "خيوط",
  accessory: "إكسسوارات",
  finished_good: "منتج جاهز",
  other: "أخرى",
};

const initialState: PurchaseFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "إنشاء طلب شراء"}
    </button>
  );
}

export default function PurchaseForm({ canCreate }: { canCreate: boolean }) {
  const [state, formAction] = useActionState(createPurchaseRequestAction, initialState);
  const departments = Object.keys(DEPARTMENT_LABELS) as DepartmentCode[];

  if (!canCreate) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية لإنشاء طلب شراء.</div>;
  }

  return (
    <form action={formAction} className="card space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">
            القسم الطالب
          </label>
          <select id="department" name="department" className="input-field">
            <option value="">غير محدد</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {DEPARTMENT_LABELS[dept]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="needed_by" className="block text-sm font-medium text-slate-700 mb-1">
            مطلوب قبل
          </label>
          <input id="needed_by" name="needed_by" type="date" className="input-field" />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">الصنف المطلوب</h3>
        <div>
          <label htmlFor="item_name" className="block text-sm font-medium text-slate-700 mb-1">
            اسم الصنف
          </label>
          <input id="item_name" name="item_name" className="input-field" required />
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
            <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">
              الكمية
            </label>
            <input id="quantity" name="quantity" type="number" min="0.01" step="0.01" className="input-field" required />
          </div>
          <div>
            <label htmlFor="unit" className="block text-sm font-medium text-slate-700 mb-1">
              الوحدة
            </label>
            <input id="unit" name="unit" className="input-field" defaultValue="قطعة" required />
          </div>
        </div>
      </section>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات الطلب
        </label>
        <textarea id="notes" name="notes" className="input-field" rows={2} />
      </div>

      <div>
        <label htmlFor="item_notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات الصنف
        </label>
        <textarea id="item_notes" name="item_notes" className="input-field" rows={2} />
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم إنشاء طلب الشراء بنجاح.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
