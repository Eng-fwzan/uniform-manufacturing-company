import { createBrowserClient } from "@supabase/ssr";
import { envPublic } from "@/lib/env/public";

/**
 * عميل Supabase للمتصفح (Client Components).
 * يستخدم anon key + RLS لحماية البيانات.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
