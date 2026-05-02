import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { envPublic } from "@/lib/env/public";

/**
 * تحديث جلسة Supabase في الـ middleware.
 * يحرص على تجديد التوكن قبل انتهائه ويحقن الـ cookies الجديدة في الاستجابة.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/dashboard");

  if (isProtected && !user) {
    const url = createSameHostUrl(request, "/login");
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && user) {
    const url = createSameHostUrl(request, "/dashboard");
    return NextResponse.redirect(url);
  }

  return response;
}

function createSameHostUrl(request: NextRequest, pathname: string) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const protocol = request.nextUrl.protocol || "http:";
  return new URL(pathname, `${protocol}//${host}`);
}
