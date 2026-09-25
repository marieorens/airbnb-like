import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { confirmBooking, releaseBooking } from "@/services/checkout";

/**
 * Webhook Stripe.
 *
 * La reservation existe deja en `pending_payment` : ce webhook ne la cree plus,
 * il la confirme. C'est le seul endroit qui fait foi pour un paiement.
 */
export async function POST(req: Request) {
  let eventType = "unknown";

  try {
    const body = await req.text();
    const signature = headers().get("stripe-signature");

    if (!signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    eventType = event.type;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;

      if (!bookingId) {
        throw new Error("Missing bookingId metadata");
      }

      await confirmBooking(bookingId, session);

      return NextResponse.json({ ok: true, eventType, bookingConfirmed: true });
    }

    // Session abandonnee ou expiree : le creneau est libere.
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;

      if (bookingId) await releaseBooking(bookingId);

      return NextResponse.json({ ok: true, eventType, bookingReleased: true });
    }

    return NextResponse.json({ ok: true, eventType, ignored: true });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        message: err instanceof Error ? err.message : "Something went wrong",
        eventType,
        ok: false,
      },
      { status: 500 }
    );
  }
}
