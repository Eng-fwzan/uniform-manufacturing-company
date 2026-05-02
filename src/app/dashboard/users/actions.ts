"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";

export type UserFormState = { error?: string; success?: boolean };

const RoleSchema = z.enum([
  "admin",
  "production_manager",
  "purchasing",
  "warehouse",
  "cutting",
  "sewing",
  "embroidery",
  "quality",
  "packing",
  "delivery",
  "accountant",
]);

const DepartmentSchema = z.enum([
  "cutting",
  "sewing",
  "embroidery",
  "quality",
  "packing",
  "delivery",
]);

export async function updateUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requirePermission("users.manage");

  const userId = String(formData.get("user_id") ?? "").trim();
  const roleRaw = formData.get("role");
  const departmentRaw = String(formData.get("department") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  const roleParsed = RoleSchema.safeParse(roleRaw);
  if (!userId || !roleParsed.success) {
    return { error: "بيانات المستخدم غير صالحة" };
  }

  let department: string | null = null;
  if (departmentRaw) {
    const deptParsed = DepartmentSchema.safeParse(departmentRaw);
    if (!deptParsed.success) {
      return { error: "القسم غير صالح" };
    }
    department = deptParsed.data;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("app_users")
    .update({
      role: roleParsed.data,
      department,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    return { error: "تعذر تحديث المستخدم. تحقق من الصلاحيات." };
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}
