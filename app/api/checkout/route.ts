import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isPaymentProvider, type PaymentProvider } from "@/lib/payments";
import { isAllowedRedirect } from "@/lib/redirects";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import { CheckoutError, createCheckout } from "@/services/checkout";

/**
 * Point d'entree de paiement pour l'application mobile.
 *
 * Le site web passe par la Server Action `createPaymentSession`, mais les deux
 * appellent la meme fonction `createCheckout` : il n'existe qu'un seul endroit
 * qui cree une reservation.
 *
 * L'identite vient du jeton Supabase envoye en `Authorization: Bearer`, jamais
 * du corps de la requete.
 */

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ message: "Authentification requise." }, { status: 401 });
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ message: "Session invalide." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Requete invalide." }, { status: 400 });
  }

  const { listingId, checkIn, checkOut, successUrl, cancelUrl, provider } = body;

  if (
    typeof listingId !== "string" ||
    typeof checkIn !== "string" ||
    typeof checkOut !== "string"
  ) {
    return NextResponse.json({ message: "Donnees de reservation invalides." }, { status: 400 });
  }

  if (provider !== undefined && !isPaymentProvider(provider)) {
    return NextResponse.json({ message: "Moyen de paiement invalide." }, { status: 400 });
  }

  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
  const requestOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin;

  if (
    !isAllowedRedirect(successUrl, requestOrigin) ||
    !isAllowedRedirect(cancelUrl, requestOrigin)
  ) {
    return NextResponse.json({ message: "Url de retour non autorisee." }, { status: 400 });
  }

  const paymentProvider: PaymentProvider = isPaymentProvider(provider)
    ? provider
    : "stripe";

  try {
    const { url, bookingId } = await createCheckout({
      userId: user.id,
      listingId,
      checkIn,
      checkOut,
      successUrl,
      cancelUrl,
      webOrigin: requestOrigin,
      provider: paymentProvider,
    });

    return NextResponse.json({ url, bookingId, provider: paymentProvider });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de créer la réservation.";
    // `code` permet au mobile d'afficher l'erreur dans la langue de l'utilisateur.
    const code = error instanceof CheckoutError ? error.code : "generic";
    return NextResponse.json({ message, code }, { status: 400 });
  }
}
