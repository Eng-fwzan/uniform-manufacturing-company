import "server-only";

import { createClient } from "@supabase/supabase-js";
import { envPublic } from "@/lib/env/public";

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key || key.includes("your-") || key.includes("replace-with")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY غير مضبوط. أضفه إلى .env.local لتفعيل إجراءات التابلت.",
    );
  }

  return key;
}

export function createSupabaseAdminClient() {
  return createClient(envPublic.NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
