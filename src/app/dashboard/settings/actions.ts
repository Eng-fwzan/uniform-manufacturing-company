"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";

export type SettingsFormState = { error?: string; success?: boolean };

const SettingsSchema = z.object({
  min_order_quantity: z.coerce.number().int().min(1).max(9999),
  purchasing_days_per_week: z.coerce.number().int().min(1).max(7),
  purchasing_default_days: z.string().optional(),
  tablet_session_timeout_min: z.coerce.number().int().min(5).max(240),
});

function splitDays(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requirePermission("settings.manage");

  const parsed = SettingsSchema.safeParse({
    min_order_quantity: formData.get("min_order_quantity"),
    purchasing_days_per_week: formData.get("purchasing_days_per_week"),
    purchasing_default_days: formData.get("purchasing_default_days"),
    tablet_session_timeout_min: formData.get("tablet_session_timeout_min"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const minPolicy = {
    enabled: formData.get("min_order_quantity_enabled") === "on",
    min_quantity: parsed.data.min_order_quantity,
  };

  const purchasingSchedule = {
    days_per_week: parsed.data.purchasing_days_per_week,
    default_days: splitDays(parsed.data.purchasing_default_days),
  };

  const overduePolicy = {
    block_new_orders: formData.get("overdue_block_new_orders") === "on",
    require_approval: formData.get("overdue_require_approval") === "on",
  };

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const updates = [
    supabase
      .from("system_settings")
      .update({ value: minPolicy, updated_at: now, updated_by: user.id })
      .eq("key", "min_order_quantity_policy"),
    supabase
      .from("system_settings")
      .update({ value: purchasingSchedule, updated_at: now, updated_by: user.id })
      .eq("key", "purchasing_schedule"),
    supabase
      .from("system_settings")
      .update({ value: overduePolicy, updated_at: now, updated_by: user.id })
      .eq("key", "overdue_customer_policy"),
    supabase
      .from("system_settings")
      .update({ value: parsed.data.tablet_session_timeout_min, updated_at: now, updated_by: user.id })
      .eq("key", "tablet_session_timeout_min"),
  ];

  const results = await Promise.all(updates);
  if (results.some((result) => result.error)) {
    return { error: "تعذر حفظ الإعدادات. تحقق من الصلاحيات." };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
