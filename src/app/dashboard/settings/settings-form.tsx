"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateSettingsAction, type SettingsFormState } from "./actions";

export type SettingsInitialValues = {
  departments: string[];
  minOrderEnabled: boolean;
  minOrderQuantity: number;
  purchasingDaysPerWeek: number;
  purchasingDefaultDays: string[];
  overdueBlock: boolean;
  overdueRequireApproval: boolean;
  tabletSessionTimeoutMin: number;
};

const initialState: SettingsFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
    </button>
  );
}

export default function SettingsForm({ initial }: { initial: SettingsInitialValues }) {
  const [state, formAction] = useActionState(updateSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">الأقسام</h2>
        <div className="flex flex-wrap gap-2">
          {initial.departments.map((dept) => (
            <span key={dept} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {dept}
            </span>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">سياسة 14 قطعة</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="min_order_quantity_enabled" defaultChecked={initial.minOrderEnabled} />
          تفعيل الحد الأدنى
        </label>
        <div>
          <label htmlFor="min_order_quantity" className="block text-sm font-medium text-slate-700 mb-1">
            الحد الأدنى للكمية
          </label>
          <input
            id="min_order_quantity"
            name="min_order_quantity"
            type="number"
            min="1"
            className="input-field"
            defaultValue={initial.minOrderQuantity}
          />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">جدولة المشتريات</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="purchasing_days_per_week" className="block text-sm font-medium text-slate-700 mb-1">
              أيام الشراء في الأسبوع
            </label>
            <input
              id="purchasing_days_per_week"
              name="purchasing_days_per_week"
              type="number"
              min="1"
              max="7"
              className="input-field"
              defaultValue={initial.purchasingDaysPerWeek}
            />
          </div>
          <div>
            <label htmlFor="purchasing_default_days" className="block text-sm font-medium text-slate-700 mb-1">
              الأيام الافتراضية (مفصولة بفواصل)
            </label>
            <input
              id="purchasing_default_days"
              name="purchasing_default_days"
              className="input-field"
              defaultValue={initial.purchasingDefaultDays.join(", ")}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">سياسة العملاء المتعثرين</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="overdue_block_new_orders" defaultChecked={initial.overdueBlock} />
          منع الطلبات الجديدة للمتعثر
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="overdue_require_approval" defaultChecked={initial.overdueRequireApproval} />
          اشتراط موافقة إدارية
        </label>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">جلسة التابلت</h2>
        <div>
          <label htmlFor="tablet_session_timeout_min" className="block text-sm font-medium text-slate-700 mb-1">
            مدة الجلسة (بالدقائق)
          </label>
          <input
            id="tablet_session_timeout_min"
            name="tablet_session_timeout_min"
            type="number"
            min="5"
            className="input-field"
            defaultValue={initial.tabletSessionTimeoutMin}
          />
        </div>
      </section>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم حفظ الإعدادات بنجاح.
        </div>
      )}

      <SaveButton />
    </form>
  );
}
