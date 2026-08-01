import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { createReservation } from "@/services/reservation";

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
      if (!event.data.object.customer_details?.email) {
        throw new Error("Missing user email");
      }

      const session = event.data.object as Stripe.Checkout.Session;

      const { listingId, startDate, endDate, totalPrice, userId } =
        session.metadata || {};

      if (!listingId || !startDate || !endDate || !totalPrice || !userId) {
        throw new Error("Invalid request metadata");
      }

      await createReservation({
        listingId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalPrice: Number(totalPrice),
        userId,
        stripeSession: session,
      });

      return NextResponse.json({
        ok: true,
        eventType,
        reservationCreated: true,
      });
    }

    return NextResponse.json({
      ok: true,
      eventType,
      ignored: true,
    });
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
