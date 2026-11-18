import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicKey, getSupabaseUrl } from "./config";
import { localizePath, splitLocale } from "@/i18n/routing";
import type { Database } from "@/types/supabase";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Rafraîchit la session Supabase, protège les pages réservées aux membres,
 * puis délègue la réponse finale à `buildResponse` (gestion de la langue).
 *
 * La session est rafraîchie *avant* de construire la réponse : les cookies mis à jour
 * sont écrits sur la requête, que la réponse transmet ensuite aux pages serveur.
 */
export async function updateSession(
  request: NextRequest,
  buildResponse: () => NextResponse
) {
  const pendingCookies: CookieToSet[] = [];

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
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const withSessionCookies = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `/en/trips` et `/trips` désignent la même page : on raisonne sans la langue.
  const { locale, pathname } = splitLocale(request.nextUrl.pathname);

  // `/verification` exige aussi un profil complet : c'est la première étape du dossier.
  const protectedRoutes = ["/favorites", "/properties", "/reservations", "/trips", "/verification"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizePath("/", locale);
    redirectUrl.search = "";
    return withSessionCookies(NextResponse.redirect(redirectUrl));
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
      redirectUrl.pathname = localizePath("/complete-profile", locale);
      // `next` reste un chemin sans langue : la redirection finale la rajoute.
      redirectUrl.search = "";
      redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return withSessionCookies(NextResponse.redirect(redirectUrl));
    }
  }

  return withSessionCookies(buildResponse());
}
