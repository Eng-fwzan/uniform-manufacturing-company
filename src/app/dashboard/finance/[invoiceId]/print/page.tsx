import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-permission";
import { COMPANY_LOGO_PATH, COMPANY_NAME } from "@/lib/brand";
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatLabel } from "@/lib/display-labels";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PrintButton from "./print-button";

type InvoicePrint = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  order: { order_number: string } | Array<{ order_number: string }> | null;
  customer: { name: string; phone: string | null } | Array<{ name: string; phone: string | null }> | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }> | null;
  payments: Array<{
    amount: number;
    payment_date: string | null;
    method: string;
    reference_number: string | null;
  }> | null;
};

function money(value: number) {
  return `${new Intl.NumberFormat("ar", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ريال`;
}

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  await requirePermission("finance.view");
  const { invoiceId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, issue_date, due_date, subtotal_amount, discount_amount, tax_amount, total_amount, notes, order:orders(order_number), customer:customers(name, phone), items:invoice_items(description, quantity, unit_price, total_amount), payments(amount, payment_date, method, reference_number)")
    .eq("id", invoiceId)
    .maybeSingle<InvoicePrint>();

  if (!invoice) notFound();

  const order = singleRelation(invoice.order);
  const customer = singleRelation(invoice.customer);
  const payments = invoice.payments ?? [];
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const remainingAmount = Math.max(Number(invoice.total_amount) - paidAmount, 0);

  return (
    <main className="min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:shadow-none">
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <Link href="/dashboard/finance" className="text-sm text-brand-600 hover:underline">
            الرجوع إلى الفواتير
          </Link>
          <PrintButton />
        </div>

        <header className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <img
                src={COMPANY_LOGO_PATH}
                alt={COMPANY_NAME}
                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
              />
              <div>
                <div className="text-sm text-slate-500">{COMPANY_NAME}</div>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">فاتورة</h1>
                <div className="mt-2 text-sm text-slate-600" dir="ltr">{invoice.invoice_number}</div>
              </div>
            </div>
            <div className="text-sm text-slate-700 md:text-left">
              <div>الحالة: {formatLabel(INVOICE_STATUS_LABELS, invoice.status)}</div>
              <div dir="ltr">تاريخ الفاتورة: {invoice.issue_date ?? "—"}</div>
              <div dir="ltr">تاريخ الاستحقاق: {invoice.due_date ?? "—"}</div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-500">العميل</h2>
            <div className="mt-2 text-lg font-bold text-slate-900">{customer?.name ?? "—"}</div>
            <div className="mt-1 text-sm text-slate-600" dir="ltr">{customer?.phone ?? "—"}</div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-500">الطلب</h2>
            <div className="mt-2 text-lg font-bold text-slate-900" dir="ltr">{order?.order_number ?? "—"}</div>
          </div>
        </section>

        <section className="py-6">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr className="text-right">
                <th className="py-3 px-2">الوصف</th>
                <th className="py-3 px-2">الكمية</th>
                <th className="py-3 px-2">سعر الوحدة</th>
                <th className="py-3 px-2">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(invoice.items ?? []).map((item) => (
                <tr key={item.description}>
                  <td className="py-3 px-2">{item.description}</td>
                  <td className="py-3 px-2">{Number(item.quantity).toLocaleString("ar")}</td>
                  <td className="py-3 px-2">{money(Number(item.unit_price))}</td>
                  <td className="py-3 px-2">{money(Number(item.total_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-6 border-t border-slate-200 pt-6 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-500">المدفوعات</h2>
            {payments.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">لا توجد مدفوعات مسجلة.</div>
            ) : (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {payments.map((payment) => (
                  <div key={`${payment.payment_date}-${payment.amount}-${payment.reference_number}`} className="flex justify-between gap-3">
                    <span>{formatLabel(PAYMENT_METHOD_LABELS, payment.method)} · {payment.payment_date ?? "—"}</span>
                    <span>{money(Number(payment.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <SummaryRow label="الإجمالي قبل الخصم والضريبة" value={money(Number(invoice.subtotal_amount))} />
            <SummaryRow label="الخصم" value={money(Number(invoice.discount_amount))} />
            <SummaryRow label="الضريبة" value={money(Number(invoice.tax_amount))} />
            <SummaryRow label="إجمالي الفاتورة" value={money(Number(invoice.total_amount))} strong />
            <SummaryRow label="المدفوع" value={money(paidAmount)} />
            <SummaryRow label="المتبقي" value={money(remainingAmount)} strong />
          </div>
        </section>

        {invoice.notes && (
          <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 print:bg-white">
            {invoice.notes}
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
      <span>{label}</span>
      <span className={strong ? "font-bold text-slate-900" : "text-slate-700"}>{value}</span>
    </div>
  );
}