import Link from "next/link";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatLabel,
} from "@/lib/display-labels";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoiceForm, PaymentForm } from "./finance-forms";

type PaymentSummary = { amount: number };

function money(value: number) {
  return `${new Intl.NumberFormat("ar", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ريال`;
}

export default async function FinancePage() {
  const user = await requirePermission("finance.view");
  const supabase = await createSupabaseServerClient();

  const [{ data: orders }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, customer:customers(name), items:order_items(product_type, quantity), invoices(id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, total_amount, order:orders(order_number), customer:customers(name), payments(amount)")
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, payment_date, method, reference_number, invoice:invoices(invoice_number), recorder:app_users(full_name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const orderOptions = (orders ?? [])
    .filter((order) => !order.invoices || order.invoices.length === 0)
    .map((order) => {
      const customer = singleRelation(order.customer);
      const firstItem = order.items?.[0];
      return {
        id: order.id as string,
        order_number: order.order_number,
        customer_name: customer?.name ?? "—",
        default_description: firstItem
          ? `${firstItem.product_type} - ${firstItem.quantity} قطعة`
          : `فاتورة الطلب ${order.order_number}`,
      };
    });

  const invoiceRows = (invoices ?? []).map((invoice) => {
    const invoicePayments = (invoice.payments ?? []) as PaymentSummary[];
    const paidAmount = invoicePayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const totalAmount = Number(invoice.total_amount);
    return {
      id: invoice.id as string,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      remaining_amount: Math.max(totalAmount - paidAmount, 0),
      order_number: singleRelation(invoice.order)?.order_number ?? "—",
      customer_name: singleRelation(invoice.customer)?.name ?? "—",
    };
  });

  const paymentOptions = invoiceRows
    .filter((invoice) => !["paid", "cancelled"].includes(invoice.status) && invoice.remaining_amount > 0)
    .map((invoice) => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      order_number: invoice.order_number,
      customer_name: invoice.customer_name,
      remaining_amount: invoice.remaining_amount,
    }));

  const canCreateInvoice = hasPermission(user.role, "invoice.create");
  const canRecordPayment = hasPermission(user.role, "payments.record");

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">الفواتير والمدفوعات</h1>
        <p className="mt-2 text-slate-600">إنشاء فاتورة للطلب وتسجيل السداد ومتابعة المتبقي.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <InvoiceForm canCreate={canCreateInvoice} orders={orderOptions} />
        <PaymentForm canRecord={canRecordPayment} invoices={paymentOptions} />
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">الفواتير</h2>
        {invoiceRows.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد فواتير بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الفاتورة</th>
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">العميل</th>
                  <th className="py-2 px-3">الإجمالي</th>
                  <th className="py-2 px-3">المدفوع</th>
                  <th className="py-2 px-3">المتبقي</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">الاستحقاق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoiceRows.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="py-2 px-3 font-medium text-slate-900" dir="ltr">
                      <Link href={`/dashboard/finance/${invoice.id}/print`} className="text-brand-600 hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="py-2 px-3">{invoice.order_number}</td>
                    <td className="py-2 px-3">{invoice.customer_name}</td>
                    <td className="py-2 px-3">{money(invoice.total_amount)}</td>
                    <td className="py-2 px-3">{money(invoice.paid_amount)}</td>
                    <td className="py-2 px-3">{money(invoice.remaining_amount)}</td>
                    <td className="py-2 px-3">{formatLabel(INVOICE_STATUS_LABELS, invoice.status)}</td>
                    <td className="py-2 px-3" dir="ltr">{invoice.due_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">آخر المدفوعات</h2>
        {!payments || payments.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد مدفوعات بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الفاتورة</th>
                  <th className="py-2 px-3">المبلغ</th>
                  <th className="py-2 px-3">الطريقة</th>
                  <th className="py-2 px-3">المرجع</th>
                  <th className="py-2 px-3">المسجل</th>
                  <th className="py-2 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-2 px-3 font-medium text-slate-900" dir="ltr">{singleRelation(payment.invoice)?.invoice_number ?? "—"}</td>
                    <td className="py-2 px-3">{money(Number(payment.amount))}</td>
                    <td className="py-2 px-3">{formatLabel(PAYMENT_METHOD_LABELS, payment.method)}</td>
                    <td className="py-2 px-3" dir="ltr">{payment.reference_number ?? "—"}</td>
                    <td className="py-2 px-3">{singleRelation(payment.recorder)?.full_name ?? "—"}</td>
                    <td className="py-2 px-3" dir="ltr">{payment.payment_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}