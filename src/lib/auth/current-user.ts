import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types/database";

/**
 * يجلب المستخدم الحالي + بياناته من جدول `app_users`.
 * يُستخدم في Server Components و Server Actions.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  return (profile as AppUser | null) ?? null;
}
