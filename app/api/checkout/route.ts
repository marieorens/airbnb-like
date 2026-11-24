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

const log = (...parts: unknown[]) => console.error("[checkout]", ...parts);

/** Refus avec un `code` stable, que le mobile affiche dans la langue de l'utilisateur. */
const refuse = (code: string, message: string, status: number) => {
  log("refus :", code, message);
  return NextResponse.json({ message, code }, { status });
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return refuse("sign_in", "Authentification requise.", 401);
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return refuse("session_expired", `Session invalide : ${authError?.message ?? "inconnue"}`, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return refuse("incomplete", "Requête invalide.", 400);
  }

  const { listingId, checkIn, checkOut, successUrl, cancelUrl, provider } = body;

  if (
    typeof listingId !== "string" ||
    typeof checkIn !== "string" ||
    typeof checkOut !== "string"
  ) {
    return refuse("incomplete", "Données de réservation invalides.", 400);
  }

  if (provider !== undefined && !isPaymentProvider(provider)) {
    return refuse("invalid_provider", "Moyen de paiement invalide.", 400);
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
    return refuse(
      "invalid_return_url",
      `Adresse de retour non autorisée : ${String(successUrl)} / ${String(cancelUrl)}`,
      400
    );
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
    log("échec :", code, message);
    return NextResponse.json({ message, code }, { status: 400 });
  }
}
