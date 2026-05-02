"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InvoiceFormState = { error?: string; success?: boolean };
export type PaymentFormState = { error?: string; success?: boolean };

const InvoiceSchema = z.object({
  order_id: z.string().uuid("الطلب مطلوب"),
  description: z.string().min(2, "وصف الفاتورة مطلوب"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unit_price: z.coerce.number().min(0, "سعر الوحدة لا يمكن أن يكون سالبًا"),
  discount_amount: z.coerce.number().min(0, "الخصم لا يمكن أن يكون سالبًا"),
  tax_amount: z.coerce.number().min(0, "الضريبة لا يمكن أن تكون سالبة"),
  issue_date: z.string().optional(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
});

const PaymentSchema = z.object({
  invoice_id: z.string().uuid("الفاتورة مطلوبة"),
  amount: z.coerce.number().positive("مبلغ السداد يجب أن يكون أكبر من صفر"),
  payment_date: z.string().optional(),
  method: z.enum(["cash", "bank_transfer", "card", "cheque", "other"]),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

type OrderForInvoice = {
  id: string;
  customer_id: string;
};

type InvoiceForPayment = {
  id: string;
  total_amount: number;
  status: string;
  payments: Array<{ amount: number }> | null;
};

export async function createInvoiceAction(
  _prevState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const user = await requirePermission("invoice.create");
  const parsed = InvoiceSchema.safeParse({
    order_id: formData.get("order_id"),
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unit_price: formData.get("unit_price"),
    discount_amount: formData.get("discount_amount") ?? "0",
    tax_amount: formData.get("tax_amount") ?? "0",
    issue_date: formData.get("issue_date") ?? "",
    due_date: formData.get("due_date") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const subtotal = toMoney(parsed.data.quantity * parsed.data.unit_price);
  const discount = toMoney(parsed.data.discount_amount);
  const tax = toMoney(parsed.data.tax_amount);
  const total = toMoney(subtotal - discount + tax);

  if (total <= 0) {
    return { error: "إجمالي الفاتورة يجب أن يكون أكبر من صفر." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("id", parsed.data.order_id)
    .maybeSingle<OrderForInvoice>();

  if (orderError || !order) {
    return { error: "تعذر العثور على الطلب." };
  }

  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();

  if (existingInvoice) {
    return { error: "يوجد فاتورة لهذا الطلب بالفعل." };
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_number: "",
      order_id: order.id,
      customer_id: order.customer_id,
      status: "issued",
      issue_date: parsed.data.issue_date || new Date().toISOString().slice(0, 10),
      due_date: parsed.data.due_date || null,
      subtotal_amount: subtotal,
      discount_amount: discount,
      tax_amount: tax,
      total_amount: total,
      notes: parsed.data.notes?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    return { error: "تعذر إنشاء الفاتورة." };
  }

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    description: parsed.data.description.trim(),
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    total_amount: subtotal,
  });

  if (itemError) {
    return { error: "تم إنشاء الفاتورة لكن تعذر حفظ بند الفاتورة." };
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/orders");
  return { success: true };
}

export async function recordPaymentAction(
  _prevState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const user = await requirePermission("payments.record");
  const parsed = PaymentSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
    amount: formData.get("amount"),
    payment_date: formData.get("payment_date") ?? "",
    method: formData.get("method") ?? "cash",
    reference_number: formData.get("reference_number") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, total_amount, status, payments(amount)")
    .eq("id", parsed.data.invoice_id)
    .maybeSingle<InvoiceForPayment>();

  if (invoiceError || !invoice) {
    return { error: "تعذر العثور على الفاتورة." };
  }

  if (["paid", "cancelled"].includes(invoice.status)) {
    return { error: "لا يمكن تسجيل سداد على فاتورة مغلقة أو ملغاة." };
  }

  const paidAmount = (invoice.payments ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const remaining = toMoney(Number(invoice.total_amount) - paidAmount);
  const amount = toMoney(parsed.data.amount);

  if (amount > remaining) {
    return { error: "مبلغ السداد أكبر من المتبقي على الفاتورة." };
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    invoice_id: invoice.id,
    amount,
    payment_date: parsed.data.payment_date || new Date().toISOString().slice(0, 10),
    method: parsed.data.method,
    reference_number: parsed.data.reference_number?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    recorded_by: user.id,
  });

  if (paymentError) {
    return { error: "تعذر تسجيل السداد." };
  }

  const newPaidAmount = toMoney(paidAmount + amount);
  const nextStatus = newPaidAmount >= Number(invoice.total_amount) ? "paid" : "partially_paid";
  await supabase
    .from("invoices")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", invoice.id);

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/orders");
  return { success: true };
}

function toMoney(value: number) {
  return Math.round(Number(value) * 100) / 100;
}