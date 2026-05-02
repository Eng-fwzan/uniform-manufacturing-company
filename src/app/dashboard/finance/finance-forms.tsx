"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PAYMENT_METHOD_LABELS } from "@/lib/display-labels";
import {
  createInvoiceAction,
  recordPaymentAction,
  type InvoiceFormState,
  type PaymentFormState,
} from "./actions";

export type OrderInvoiceOption = {
  id: string;
  order_number: string;
  customer_name: string;
  default_description: string;
};

export type PaymentInvoiceOption = {
  id: string;
  invoice_number: string;
  order_number: string;
  customer_name: string;
  remaining_amount: number;
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function InvoiceForm({ canCreate, orders }: { canCreate: boolean; orders: OrderInvoiceOption[] }) {
  const [state, formAction] = useActionState<InvoiceFormState, FormData>(createInvoiceAction, {});
  const firstDescription = orders[0]?.default_description ?? "";

  if (!canCreate) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية إنشاء الفواتير.</div>;
  }

  if (orders.length === 0) {
    return <div className="card text-sm text-slate-600">لا توجد طلبات متاحة لإنشاء فاتورة جديدة.</div>;
  }

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">إنشاء فاتورة</h2>
      <div>
        <label htmlFor="order_id" className="block text-sm font-medium text-slate-700 mb-1">الطلب</label>
        <select id="order_id" name="order_id" className="input-field" required>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>{order.order_number} · {order.customer_name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">وصف البند</label>
        <input id="description" name="description" className="input-field" defaultValue={firstDescription} required />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">الكمية</label>
          <input id="quantity" name="quantity" type="number" min="0.01" step="0.01" className="input-field" defaultValue={1} required />
        </div>
        <div>
          <label htmlFor="unit_price" className="block text-sm font-medium text-slate-700 mb-1">سعر الوحدة</label>
          <input id="unit_price" name="unit_price" type="number" min="0" step="0.01" className="input-field" required />
        </div>
        <div>
          <label htmlFor="tax_amount" className="block text-sm font-medium text-slate-700 mb-1">الضريبة</label>
          <input id="tax_amount" name="tax_amount" type="number" min="0" step="0.01" className="input-field" defaultValue={0} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="discount_amount" className="block text-sm font-medium text-slate-700 mb-1">الخصم</label>
          <input id="discount_amount" name="discount_amount" type="number" min="0" step="0.01" className="input-field" defaultValue={0} />
        </div>
        <div>
          <label htmlFor="issue_date" className="block text-sm font-medium text-slate-700 mb-1">تاريخ الفاتورة</label>
          <input id="issue_date" name="issue_date" type="date" className="input-field" />
        </div>
        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-slate-700 mb-1">تاريخ الاستحقاق</label>
          <input id="due_date" name="due_date" type="date" className="input-field" />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
        <textarea id="notes" name="notes" className="input-field" rows={2} />
      </div>
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {state?.success && !state.error && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">تم إنشاء الفاتورة.</div>}
      <SubmitButton label="إنشاء الفاتورة" pendingLabel="جارٍ إنشاء الفاتورة..." />
    </form>
  );
}

export function PaymentForm({ canRecord, invoices }: { canRecord: boolean; invoices: PaymentInvoiceOption[] }) {
  const [state, formAction] = useActionState<PaymentFormState, FormData>(recordPaymentAction, {});
  const firstRemaining = invoices[0]?.remaining_amount ?? 0;

  if (!canRecord) {
    return <div className="card text-sm text-slate-600">ليس لديك صلاحية تسجيل المدفوعات.</div>;
  }

  if (invoices.length === 0) {
    return <div className="card text-sm text-slate-600">لا توجد فواتير مفتوحة لتسجيل سداد.</div>;
  }

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">تسجيل سداد</h2>
      <div>
        <label htmlFor="invoice_id" className="block text-sm font-medium text-slate-700 mb-1">الفاتورة</label>
        <select id="invoice_id" name="invoice_id" className="input-field" required>
          {invoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoice_number} · {invoice.order_number} · المتبقي {invoice.remaining_amount.toLocaleString("ar")} ريال
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">مبلغ السداد</label>
          <input id="amount" name="amount" type="number" min="0.01" step="0.01" className="input-field" defaultValue={firstRemaining || undefined} required />
        </div>
        <div>
          <label htmlFor="method" className="block text-sm font-medium text-slate-700 mb-1">طريقة السداد</label>
          <select id="method" name="method" className="input-field">
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payment_date" className="block text-sm font-medium text-slate-700 mb-1">تاريخ السداد</label>
          <input id="payment_date" name="payment_date" type="date" className="input-field" />
        </div>
      </div>
      <div>
        <label htmlFor="reference_number" className="block text-sm font-medium text-slate-700 mb-1">رقم المرجع</label>
        <input id="reference_number" name="reference_number" className="input-field" dir="ltr" />
      </div>
      <div>
        <label htmlFor="payment_notes" className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
        <textarea id="payment_notes" name="notes" className="input-field" rows={2} />
      </div>
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {state?.success && !state.error && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">تم تسجيل السداد.</div>}
      <SubmitButton label="تسجيل السداد" pendingLabel="جارٍ تسجيل السداد..." />
    </form>
  );
}