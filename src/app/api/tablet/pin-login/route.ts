import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * نقطة طرفية للتحقق من PIN على التابلت.
 *
 * ⚠️ ملاحظة Phase 0:
 * - التحقق الفعلي من pin_hash يتم على Supabase باستخدام RPC آمن
 *   (يستخدم crypt() مع pgcrypto لمقارنة آمنة).
 * - في Phase 1 سنضيف:
 *   1) Supabase RPC اسمها `verify_department_pin(p_pin text, p_dept department_code)`
 *   2) إنشاء جلسة قصيرة (cookie HttpOnly) خاصة بالتابلت + القسم
 *   3) معدل محاولات (rate limit) لمنع التخمين
 *
 * هنا نُرجع 501 Not Implemented حتى يتم تنفيذ Phase 1.
 */

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

  return NextResponse.json(
    {
      error:
        "تسجيل دخول التابلت بـ PIN سيُفعَّل في Phase 1. " +
        "حاليًا استخدم تسجيل الدخول العادي من /login.",
    },
    { status: 501 },
  );
}
