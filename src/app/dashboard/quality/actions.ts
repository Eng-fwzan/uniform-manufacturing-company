"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type QualityFormState = { error?: string; success?: boolean };

const QualitySchema = z.object({
  batch_id: z.string().uuid("الدفعة مطلوبة"),
  result: z.enum(["passed", "failed", "rework"]),
  checked_quantity: z.coerce.number().int().positive("كمية الفحص يجب أن تكون أكبر من صفر"),
  failed_quantity: z.coerce.number().int().min(0, "كمية الرفض لا يمكن أن تكون سالبة"),
  notes: z.string().optional(),
});

type BatchForQuality = {
  id: string;
  order_id: string;
  quantity: number;
  current_department: string | null;
  status: string;
};

export async function recordQualityAction(
  _prevState: QualityFormState,
  formData: FormData,
): Promise<QualityFormState> {
  const user = await requirePermission("quality.record");
  const parsed = QualitySchema.safeParse({
    batch_id: formData.get("batch_id"),
    result: formData.get("result"),
    checked_quantity: formData.get("checked_quantity"),
    failed_quantity: formData.get("failed_quantity") ?? "0",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  if (parsed.data.failed_quantity > parsed.data.checked_quantity) {
    return { error: "كمية الرفض لا يمكن أن تكون أكبر من كمية الفحص." };
  }

  if (parsed.data.result === "passed" && parsed.data.failed_quantity > 0) {
    return { error: "لا يمكن اعتماد الدفعة كناجحة مع وجود كمية مرفوضة." };
  }

  if (parsed.data.result !== "passed" && parsed.data.failed_quantity === 0) {
    return { error: "حدد كمية الرفض أو إعادة العمل." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, order_id, quantity, current_department, status")
    .eq("id", parsed.data.batch_id)
    .maybeSingle<BatchForQuality>();

  if (batchError || !batch) {
    return { error: "تعذر العثور على الدفعة." };
  }

  if (batch.current_department !== "quality" || batch.status === "closed") {
    return { error: "لا يمكن تسجيل جودة إلا على دفعة موجودة في قسم الجودة وغير مغلقة." };
  }

  if (parsed.data.checked_quantity > Number(batch.quantity)) {
    return { error: "كمية الفحص أكبر من كمية الدفعة." };
  }

  const notes = parsed.data.notes?.trim() || null;
  const { error: recordError } = await supabase.from("quality_records").insert({
    batch_id: batch.id,
    order_id: batch.order_id,
    result: parsed.data.result,
    checked_quantity: parsed.data.checked_quantity,
    failed_quantity: parsed.data.failed_quantity,
    notes,
    checked_by: user.id,
  });

  if (recordError) {
    return { error: "تعذر حفظ سجل الجودة." };
  }

  if (parsed.data.result !== "passed") {
    const { error: movementError } = await supabase.from("quantity_movements").insert({
      order_id: batch.order_id,
      batch_id: batch.id,
      department: "quality",
      movement_type: parsed.data.result === "failed" ? "damaged" : "rework",
      quantity: parsed.data.failed_quantity,
      reason: notes ?? (parsed.data.result === "failed" ? "رفض جودة" : "إعادة عمل من الجودة"),
      recorded_by: user.id,
    });

    if (movementError) {
      return { error: "تم حفظ الجودة لكن تعذر تسجيل حركة الكمية." };
    }
  }

  revalidatePath("/dashboard/quality");
  revalidatePath("/dashboard/movements");
  revalidatePath("/dashboard/orders");

  return { success: true };
}