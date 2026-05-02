import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { DepartmentCode, UserRole, UUID } from "@/lib/types/database";

export const TABLET_SESSION_COOKIE = "umc_tablet_session";

const DEFAULT_SESSION_TIMEOUT_MIN = 30;

export interface TabletSessionPayload {
  userId: UUID;
  fullName: string;
  role: UserRole;
  department: DepartmentCode;
  expiresAt: number;
}

function getTabletSessionSecret() {
  const secret = process.env.TABLET_SESSION_SECRET;

  if (!secret || secret.includes("your-") || secret.includes("replace-with") || secret.length < 24) {
    throw new Error(
      "TABLET_SESSION_SECRET غير مضبوط. أضفه إلى .env.local بقيمة عشوائية طويلة قبل تفعيل PIN.",
    );
  }

  return secret;
}

export function tabletSessionTimeoutSeconds() {
  const raw = process.env.TABLET_SESSION_TIMEOUT_MIN;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_SESSION_TIMEOUT_MIN;
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_TIMEOUT_MIN;

  return minutes * 60;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getTabletSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function createTabletSessionCookieValue(payload: TabletSessionPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function parseTabletSessionCookie(value: string | undefined): TabletSessionPayload | null {
  if (!value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  if (!signaturesMatch(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as TabletSessionPayload;

    if (!payload.expiresAt || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getTabletSession() {
  const cookieStore = await cookies();
  return parseTabletSessionCookie(cookieStore.get(TABLET_SESSION_COOKIE)?.value);
}

export function tabletCookieOptions(maxAgeSeconds = tabletSessionTimeoutSeconds()) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/tablet",
    maxAge: maxAgeSeconds,
  };
}