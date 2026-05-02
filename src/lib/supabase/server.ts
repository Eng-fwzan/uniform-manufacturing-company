import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { envPublic } from "@/lib/env/public";

/**
 * عميل Supabase للخادم (Server Components / Route Handlers / Server Actions).
 * يقرأ الجلسة من الـ cookies ويحدّثها تلقائيًا.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // متوقع في Server Components — يتم التحديث في middleware
          }
        },
      },
    },
  );
}
