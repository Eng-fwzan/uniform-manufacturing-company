import { NextResponse } from "next/server";
import { TABLET_SESSION_COOKIE, tabletCookieOptions } from "@/lib/tablet/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/tablet", request.url), 303);
  response.cookies.set(TABLET_SESSION_COOKIE, "", tabletCookieOptions(0));

  return response;
}