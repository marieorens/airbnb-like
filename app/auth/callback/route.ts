import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/types/supabase";

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl.clone();
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const debug = requestUrl.searchParams.get("debug") === "1";
  let response = NextResponse.redirect(new URL(next, requestUrl.origin));

  if (!code) {
    if (debug) {
      return NextResponse.json({
        ok: false,
        error: "Missing code query parameter",
        searchParams: Object.fromEntries(requestUrl.searchParams.entries()),
      });
    }

    return response;
  }

  const cookiesToSet: { name: string; value: string }[] = [];
  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookiesToSet) {
          nextCookiesToSet.forEach(({ name, value, options }) => {
            cookiesToSet.push({ name, value });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (debug) {
    return NextResponse.json({
      ok: !error,
      hasSession: Boolean(data.session),
      hasUser: Boolean(data.user),
      error: error?.message ?? null,
      incomingSupabaseCookieNames: request.cookies
        .getAll()
        .map((cookie) => cookie.name)
        .filter((name) => name.startsWith("sb-")),
      outgoingSupabaseCookieNames: cookiesToSet
        .map((cookie) => cookie.name)
        .filter((name) => name.startsWith("sb-")),
    });
  }

  if (error) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  return response;
}
