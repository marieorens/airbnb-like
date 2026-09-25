import { differenceInCalendarDays } from "date-fns";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import type { Tables } from "@/types/supabase";

/**
 * Devises sans sous-unite chez Stripe : le montant s'envoie tel quel, sans
 * multiplication par 100. XOF en fait partie, et le produit la cible.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export const toStripeAmount = (amount: number, currency: string): number =>
  ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);

/** La session expire au bout d'une heure : les dates ne restent pas bloquees. */
const SESSION_TTL_SECONDS = 60 * 60;

const CANCELLED_STATUSES = [
  "cancelled_by_guest",
  "cancelled_by_host",
  "refunded",
];

type CheckoutInput = {
  /** Identifiant deja verifie : cookie de session cote web, JWT cote mobile. */
  userId: string;
  listingId: string;
  /** Format AAAA-MM-JJ. */
  checkIn: string;
  checkOut: string;
  successUrl: string;
  cancelUrl: string;
};

type ListingRow = Pick<
  Tables<"listings">,
  | "id"
  | "title"
  | "host_id"
  | "price_per_night"
  | "currency"
  | "transaction_type"
  | "status"
> & {
  listing_photos?:
    | Pick<Tables<"listing_photos">, "public_url" | "storage_path" | "position">[]
    | null;
};

const toDate = (value: string) => new Date(`${value}T00:00:00`);

/**
 * Cree la reservation puis la session de paiement.
 *
 * Point d'entree unique du paiement, partage par le site web et l'application
 * mobile. La reservation est ecrite en `pending_payment` **avant** le paiement :
 * le creneau est ainsi reserve, et l'utilisateur voit sa reservation meme si le
 * webhook tarde. Le webhook la fait ensuite passer en `confirmed`.
 *
 * Le montant n'est jamais lu depuis le client : il est recalcule ici.
 */
export async function createCheckout({
  userId,
  listingId,
  checkIn,
  checkOut,
  successUrl,
  cancelUrl,
}: CheckoutInput) {
  if (!listingId || !checkIn || !checkOut) {
    throw new Error("Donnees de reservation incompletes.");
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "full_name, email, phone, country_of_residence, city_of_residence, country_of_origin, account_purpose, profile_completed_at"
    )
    .eq("id", userId)
    .single();

  const isProfileComplete = Boolean(
    profile?.profile_completed_at &&
      profile?.full_name &&
      profile?.email &&
      profile?.phone &&
      profile?.country_of_residence &&
      profile?.city_of_residence &&
      profile?.country_of_origin &&
      (profile?.account_purpose?.length ?? 0) > 0
  );

  if (!isProfileComplete) {
    throw new Error("Completez votre profil avant de reserver.");
  }

  const { data, error } = await admin
    .from("listings")
    .select(
      "id, title, host_id, price_per_night, currency, transaction_type, status, listing_photos(public_url, storage_path, position)"
    )
    .eq("id", listingId)
    .single();

  const listing = data as unknown as ListingRow | null;

  if (error || !listing) throw new Error("Annonce introuvable.");
  if (listing.status !== "published") {
    throw new Error("Cette annonce n'est pas disponible.");
  }
  if (listing.transaction_type !== "booking") {
    throw new Error("Cette annonce n'est pas reservable en ligne.");
  }
  if (listing.host_id === userId) {
    throw new Error("Vous ne pouvez pas reserver votre propre bien.");
  }

  const start = toDate(checkIn);
  const end = toDate(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Dates invalides.");
  }

  // Meme regle que le web : les deux journees bornes sont comptees.
  const nightCount = Math.max(differenceInCalendarDays(end, start) + 1, 1);
  const totalPrice = nightCount * listing.price_per_night;

  const { data: existing } = await admin
    .from("bookings")
    .select("check_in, check_out, status")
    .eq("listing_id", listingId)
    .not("status", "in", `(${CANCELLED_STATUSES.map((s) => `"${s}"`).join(",")})`);

  const hasConflict = (existing ?? []).some((booking) => {
    const bookedStart = toDate(booking.check_in);
    const bookedEnd = toDate(booking.check_out);
    return bookedStart <= end && bookedEnd >= start;
  });

  if (hasConflict) {
    throw new Error("Ces dates viennent d'etre reservees. Choisissez-en d'autres.");
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .insert({
      listing_id: listing.id,
      guest_id: userId,
      host_id: listing.host_id,
      check_in: checkIn,
      check_out: checkOut,
      night_count: nightCount,
      price_per_night: listing.price_per_night,
      total_price: totalPrice,
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    throw new Error(bookingError?.message || "Impossible de creer la reservation.");
  }

  const sortedPhotos = [...(listing.listing_photos ?? [])].sort(
    (a, b) => a.position - b.position
  );
  const image = sortedPhotos[0]?.public_url || sortedPhotos[0]?.storage_path;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      metadata: { bookingId: booking.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            // La devise de l'annonce, plus jamais USD en dur.
            currency: listing.currency.toLowerCase(),
            unit_amount: toStripeAmount(totalPrice, listing.currency),
            product_data: {
              name: listing.title,
              description: `${nightCount} nuit${nightCount > 1 ? "s" : ""}`,
              images: image ? [image] : undefined,
            },
          },
        },
      ],
    });

    return { url: session.url, bookingId: booking.id, totalPrice, nightCount };
  } catch (stripeError) {
    // Pas de session de paiement : la reservation ne doit pas bloquer le creneau.
    await admin
      .from("bookings")
      .update({ status: "cancelled_by_guest" })
      .eq("id", booking.id);
    throw stripeError;
  }
}

/** Paiement confirme : seul le webhook appelle cette fonction. */
export async function confirmBooking(
  bookingId: string,
  session: Stripe.Checkout.Session
) {
  const admin = createAdminClient();

  const { data: booking, error } = await admin
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId)
    .select("id, guest_id, total_price")
    .single();

  if (error || !booking) {
    throw new Error(error?.message || "Reservation introuvable.");
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  await admin.from("payments").insert({
    booking_id: booking.id,
    user_id: booking.guest_id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntent ?? null,
    amount: booking.total_price,
    currency: session.currency ?? "usd",
    status: "paid",
  });

  return booking;
}

/** Session expiree ou abandonnee : on libere le creneau. */
export async function releaseBooking(bookingId: string) {
  const admin = createAdminClient();

  await admin
    .from("bookings")
    .update({ status: "cancelled_by_guest" })
    .eq("id", bookingId)
    .eq("status", "pending_payment");
}
