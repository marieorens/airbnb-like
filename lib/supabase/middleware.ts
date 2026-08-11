import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicKey, getSupabaseUrl } from "./config";
import type { Database } from "@/types/supabase";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoutes = ["/favorites", "/properties", "/reservations", "/trips"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtectedRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "full_name, phone, country_of_residence, city_of_residence, country_of_origin, account_purpose, profile_completed_at"
      )
      .eq("id", user.id)
      .single();

    const isProfileComplete = Boolean(
      profile?.profile_completed_at &&
        profile?.full_name &&
        profile?.phone &&
        profile?.country_of_residence &&
        profile?.city_of_residence &&
        profile?.country_of_origin &&
        (profile?.account_purpose?.length ?? 0) > 0
    );

    if (!isProfileComplete) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/complete-profile";
      redirectUrl.searchParams.set(
        "next",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
