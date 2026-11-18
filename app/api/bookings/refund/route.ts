import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import { stripe } from "@/lib/stripe";

/**
 * Remboursement Stripe declenche depuis le backoffice.
 *
 * Le backoffice ne detient pas la cle secrete Stripe : il envoie le JWT de
 * l'administrateur, cette route verifie son role puis effectue le remboursement
 * et met a jour les statuts. Un seul endroit touche a Stripe, comme pour le
 * paiement.
 *
 * Le remboursement est total et idempotent : la cle d'idempotence derive de la
 * ligne `payments`, donc un nouvel essai apres un echec reseau ne rembourse pas
 * deux fois.
 */

const isAlreadyRefunded = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "charge_already_refunded";

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
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const bookingId = body.bookingId;
  if (typeof bookingId !== "string" || !bookingId) {
    return NextResponse.json({ message: "Réservation invalide." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ message: "Réservation introuvable." }, { status: 404 });
  }

  // Une reservation deja marquee remboursee peut encore avoir un paiement
  // `paid` (remboursement Stripe jamais effectue, ou statut synchronise a la
  // main). On ne s'arrete donc pas a ce statut : les paiements payes encore
  // presents sont rembourses, ce qui permet de regulariser l'ancien cas.
  const { data: payments, error: paymentsError } = await admin
    .from("payments")
    .select("id, stripe_payment_intent_id, stripe_checkout_session_id")
    .eq("booking_id", bookingId)
    .eq("status", "paid");

  if (paymentsError) {
    return NextResponse.json({ message: paymentsError.message }, { status: 500 });
  }

  const paidPayments = payments ?? [];

  // Deux admins ont clique en meme temps : le premier a deja rembourse les
  // paiements, il reste a synchroniser le statut de la reservation.
  if (paidPayments.length === 0) {
    if (booking.status === "pending_payment") {
      return NextResponse.json(
        { message: "Aucun paiement à rembourser sur cette réservation." },
        { status: 409 }
      );
    }

    const { error } = await admin
      .from("bookings")
      .update({ status: "refunded" })
      .eq("id", bookingId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      alreadyRefunded: booking.status === "refunded",
      refundedPayments: 0,
    });
  }

  // On resout tous les intents avant de rembourser : un paiement sans intent
  // doit bloquer l'operation avant qu'un remboursement partiel ne soit lance.
  const refunds: { paymentId: string; paymentIntent: string }[] = [];

  for (const payment of paidPayments) {
    let paymentIntent = payment.stripe_payment_intent_id;

    if (!paymentIntent && payment.stripe_checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(
        payment.stripe_checkout_session_id
      );
      paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
    }

    if (!paymentIntent) {
      return NextResponse.json(
        {
          message:
            "Un paiement n'a pas d'intent Stripe. Le remboursement doit être fait manuellement.",
        },
        { status: 409 }
      );
    }

    refunds.push({ paymentId: payment.id, paymentIntent });
  }

  for (const refund of refunds) {
    try {
      await stripe.refunds.create(
        { payment_intent: refund.paymentIntent },
        { idempotencyKey: `booking-refund-${refund.paymentId}` }
      );
    } catch (error) {
      if (isAlreadyRefunded(error)) continue;

      return NextResponse.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Le remboursement Stripe a échoué.",
        },
        { status: 502 }
      );
    }
  }

  const { error: paymentUpdateError } = await admin
    .from("payments")
    .update({ status: "refunded" })
    .in(
      "id",
      refunds.map((refund) => refund.paymentId)
    );

  if (paymentUpdateError) {
    return NextResponse.json({ message: paymentUpdateError.message }, { status: 500 });
  }

  const { error: bookingUpdateError } = await admin
    .from("bookings")
    .update({ status: "refunded" })
    .eq("id", bookingId);

  if (bookingUpdateError) {
    return NextResponse.json({ message: bookingUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    alreadyRefunded: booking.status === "refunded",
    refundedPayments: refunds.length,
  });
}
