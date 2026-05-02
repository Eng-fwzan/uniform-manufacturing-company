"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCustomerAction, type CustomerFormState } from "./actions";

const initialState: CustomerFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "حفظ العميل"}
    </button>
  );
}

export default function CustomerForm() {
  const [state, formAction] = useActionState(createCustomerAction, initialState);

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
          اسم العميل
        </label>
        <input id="name" name="name" className="input-field" required />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
          الهاتف
        </label>
        <input id="phone" name="phone" className="input-field" dir="ltr" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="classification" className="block text-sm font-medium text-slate-700 mb-1">
            التصنيف
          </label>
          <select id="classification" name="classification" className="input-field">
            <option value="cash">نقدي</option>
            <option value="credit_approved">آجل معتمد</option>
            <option value="overdue">متعثر</option>
          </select>
        </div>
        <div>
          <label htmlFor="credit_limit" className="block text-sm font-medium text-slate-700 mb-1">
            حد ائتماني
          </label>
          <input id="credit_limit" name="credit_limit" type="number" min="0" className="input-field" defaultValue={0} />
        </div>
        <div>
          <label htmlFor="payment_terms_days" className="block text-sm font-medium text-slate-700 mb-1">
            مدة السداد (يوم)
          </label>
          <input id="payment_terms_days" name="payment_terms_days" type="number" min="0" className="input-field" defaultValue={0} />
        </div>
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم حفظ العميل بنجاح.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
