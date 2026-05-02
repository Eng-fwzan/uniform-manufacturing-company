import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTabletSessionCookieValue,
  TABLET_SESSION_COOKIE,
  tabletCookieOptions,
  tabletSessionTimeoutSeconds,
} from "@/lib/tablet/session";
import type { DepartmentCode, UserRole, UUID } from "@/lib/types/database";

/**
 * نقطة طرفية للتحقق من PIN على التابلت.
 * تعتمد على RPC آمن في Supabase لمقارنة pin_hash، ثم تنشئ جلسة قصيرة للقسم.
 */

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type VerifiedTabletUser = {
  id: UUID;
  full_name: string;
  role: UserRole;
  department: DepartmentCode;
};

const attempts = new Map<string, RateLimitEntry>();

const bodySchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, "أرقام فقط"),
  department: z.enum([
    "cutting",
    "sewing",
    "embroidery",
    "quality",
    "packing",
    "delivery",
  ]),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "PIN غير صالح" }, { status: 400 });
  }

  const rateLimitKey = `${clientKey(request)}:${parsed.data.department}`;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى" },
      { status: 429 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("verify_department_pin", {
      p_pin: parsed.data.pin,
      p_dept: parsed.data.department,
    })
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "تعذر التحقق من PIN. تأكد من تشغيل migration الخاصة بالتابلت" },
      { status: 500 },
    );
  }

  const user = data as VerifiedTabletUser | null;
  if (!user) {
    registerFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: "PIN غير صحيح لهذا القسم" }, { status: 401 });
  }

  clearRateLimit(rateLimitKey);

  const maxAge = tabletSessionTimeoutSeconds();
  const response = NextResponse.json({ ok: true, department: user.department });
  response.cookies.set(
    TABLET_SESSION_COOKIE,
    createTabletSessionCookieValue({
      userId: user.id,
      fullName: user.full_name,
      role: user.role,
      department: user.department,
      expiresAt: Date.now() + maxAge * 1000,
    }),
    tabletCookieOptions(maxAge),
  );

  return response;
}

function clientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip") || "local";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return `${ip}:${userAgent}`;
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  return { allowed: entry.count < RATE_LIMIT_MAX_ATTEMPTS };
}

function registerFailedAttempt(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  entry.count += 1;
}

function clearRateLimit(key: string) {
  attempts.delete(key);
}
