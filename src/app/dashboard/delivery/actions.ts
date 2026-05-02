"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeliveryFormState = { error?: string; success?: boolean };

const DeliverySchema = z.object({
  batch_id: z.string().uuid("الدفعة مطلوبة"),
  delivered_quantity: z.coerce.number().int().positive("كمية التسليم يجب أن تكون أكبر من صفر"),
  recipient_name: z.string().min(2, "اسم المستلم مطلوب"),
  recipient_phone: z.string().optional(),
  notes: z.string().optional(),
});

type BatchForDelivery = {
  id: string;
  order_id: string;
  quantity: number;
  current_department: string | null;
  status: string;
};

export async function recordDeliveryAction(
  _prevState: DeliveryFormState,
  formData: FormData,
): Promise<DeliveryFormState> {
  const user = await requirePermission("delivery.create");
  const parsed = DeliverySchema.safeParse({
    batch_id: formData.get("batch_id"),
    delivered_quantity: formData.get("delivered_quantity"),
    recipient_name: formData.get("recipient_name"),
    recipient_phone: formData.get("recipient_phone") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, order_id, quantity, current_department, status")
    .eq("id", parsed.data.batch_id)
    .maybeSingle<BatchForDelivery>();

  if (batchError || !batch) {
    return { error: "تعذر العثور على الدفعة." };
  }

  if (batch.current_department !== "delivery" || batch.status === "closed") {
    return { error: "لا يمكن تسجيل التسليم إلا على دفعة موجودة في قسم التسليم وغير مغلقة." };
  }

  if (parsed.data.delivered_quantity > Number(batch.quantity)) {
    return { error: "كمية التسليم أكبر من كمية الدفعة." };
  }

  const { data: existingDelivery } = await supabase
    .from("delivery_records")
    .select("id")
    .eq("batch_id", batch.id)
    .maybeSingle();

  if (existingDelivery) {
    return { error: "هذه الدفعة لديها سجل تسليم سابق." };
  }

  const { error: deliveryError } = await supabase.from("delivery_records").insert({
    batch_id: batch.id,
    order_id: batch.order_id,
    delivered_quantity: parsed.data.delivered_quantity,
    recipient_name: parsed.data.recipient_name.trim(),
    recipient_phone: parsed.data.recipient_phone?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    delivered_by: user.id,
  });

  if (deliveryError) {
    return { error: "تعذر حفظ سجل التسليم." };
  }

  const now = new Date().toISOString();
  const { error: closeError } = await supabase
    .from("batches")
    .update({ status: "closed", updated_at: now })
    .eq("id", batch.id);

  if (closeError) {
    return { error: "تم حفظ التسليم لكن تعذر إغلاق الدفعة." };
  }

  await completeOrderIfAllBatchesClosed(batch.order_id);

  revalidatePath("/dashboard/delivery");
  revalidatePath("/dashboard/batches");
  revalidatePath("/dashboard/orders");

  return { success: true };
}

async function completeOrderIfAllBatchesClosed(orderId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("batches")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .neq("status", "closed");

  if (!error && count === 0) {
    await supabase
      .from("orders")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
  }
}