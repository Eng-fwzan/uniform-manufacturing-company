"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";

export type MovementFormState = { error?: string; success?: boolean };

const MovementSchema = z.object({
  order_id: z.string().uuid("الطلب مطلوب"),
  batch_id: z.string().uuid().optional(),
  department: z.enum(["cutting", "sewing", "embroidery", "quality", "packing", "delivery"]),
  movement_type: z.enum([
    "extra_cut",
    "shortage",
    "damaged",
    "waste",
    "free_giveaway",
    "rework",
  ]),
  quantity: z.coerce.number().int().positive("الكمية يجب أن تكون أكبر من صفر"),
  reason: z.string().min(3, "السبب مطلوب"),
});

export async function createMovementAction(
  _prevState: MovementFormState,
  formData: FormData,
): Promise<MovementFormState> {
  const user = await requirePermission("movements.create");

  const rawBatch = String(formData.get("batch_id") ?? "").trim();

  const parsed = MovementSchema.safeParse({
    order_id: formData.get("order_id"),
    batch_id: rawBatch.length > 0 ? rawBatch : undefined,
    department: formData.get("department"),
    movement_type: formData.get("movement_type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("quantity_movements").insert({
    order_id: parsed.data.order_id,
    batch_id: parsed.data.batch_id ?? null,
    department: parsed.data.department,
    movement_type: parsed.data.movement_type,
    quantity: parsed.data.quantity,
    reason: parsed.data.reason.trim(),
    recorded_by: user.id,
  });

  if (error) {
    return { error: "تعذر تسجيل الحركة. تحقق من الصلاحيات أو البيانات." };
  }

  revalidatePath("/dashboard/movements");
  return { success: true };
}
