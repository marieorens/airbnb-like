import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import { createCheckout } from "@/services/checkout";

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

/** Empeche une redirection ouverte : on n'accepte que nos propres cibles. */
function isAllowedRedirect(url: unknown): url is string {
  if (typeof url !== "string" || !url) return false;

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "";
  return (
    url.startsWith("vacationhub://") ||
    url.startsWith("exp://") ||
    (Boolean(serverUrl) && url.startsWith(serverUrl))
  );
}

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

  const { listingId, checkIn, checkOut, successUrl, cancelUrl } = body;

  if (
    typeof listingId !== "string" ||
    typeof checkIn !== "string" ||
    typeof checkOut !== "string"
  ) {
    return NextResponse.json({ message: "Donnees de reservation invalides." }, { status: 400 });
  }

  if (!isAllowedRedirect(successUrl) || !isAllowedRedirect(cancelUrl)) {
    return NextResponse.json({ message: "Url de retour non autorisee." }, { status: 400 });
  }

  try {
    const { url, bookingId } = await createCheckout({
      userId: user.id,
      listingId,
      checkIn,
      checkOut,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ url, bookingId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de creer la reservation.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
