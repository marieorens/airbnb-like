import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/types/supabase";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl.clone();
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const debug = requestUrl.searchParams.get("debug") === "1";
  const cookiesToSet: CookieToSet[] = [];

  if (!code) {
    if (debug) {
      return NextResponse.json({
        ok: false,
        error: "Missing code query parameter",
        searchParams: Object.fromEntries(requestUrl.searchParams.entries()),
      });
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookiesToSet) {
          cookiesToSet.push(...nextCookiesToSet);
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  const response = debug
    ? NextResponse.json({
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
      })
    : NextResponse.redirect(new URL(error ? "/" : next, requestUrl.origin));

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
