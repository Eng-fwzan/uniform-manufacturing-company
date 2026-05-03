"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";

export type CustomerFormState = { error?: string; success?: boolean };

const CustomerSchema = z.object({
  name: z.string().min(2, "اسم العميل مطلوب"),
  phone: z.string().optional(),
  classification: z.enum(["cash", "credit_approved", "overdue"]),
  credit_limit: z.coerce.number().min(0),
  payment_terms_days: z.coerce.number().min(0),
});

export async function createCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requirePermission("customers.manage");

  const parsed = CustomerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    classification: formData.get("classification") ?? "cash",
    credit_limit: formData.get("credit_limit") ?? "0",
    payment_terms_days: formData.get("payment_terms_days") ?? "0",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const payload = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("customers").insert({
    name: payload.name.trim(),
    phone: payload.phone ? String(payload.phone).trim() : null,
    classification: payload.classification,
    credit_limit: payload.credit_limit,
    payment_terms_days: payload.payment_terms_days,
  });

  if (error) {
    return { error: "تعذر حفظ العميل. تحقق من الصلاحيات أو البيانات." };
  }

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/orders");
  return { success: true };
}
