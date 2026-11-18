import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

// Routes techniques sans langue : API (mobile, webhooks) et retours d'authentification,
// dont les URL sont enregistrées chez Supabase, Google et Stripe.
const isTechnicalRoute = (pathname: string) =>
  pathname.startsWith("/api") || pathname.startsWith("/auth");

export async function middleware(request: NextRequest) {
  return updateSession(request, () =>
    isTechnicalRoute(request.nextUrl.pathname)
      ? NextResponse.next({ request })
      : intlMiddleware(request)
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
