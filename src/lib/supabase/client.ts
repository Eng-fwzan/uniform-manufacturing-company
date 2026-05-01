import { createBrowserClient } from "@supabase/ssr";

/**
 * عميل Supabase للمتصفح (Client Components).
 * يستخدم anon key + RLS لحماية البيانات.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
