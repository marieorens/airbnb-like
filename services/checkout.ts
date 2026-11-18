import { differenceInCalendarDays } from "date-fns";
import type Stripe from "stripe";

import { isKkiapaySandbox, type KkiapayTransaction } from "@/lib/kkiapay";
import type { PaymentProvider } from "@/lib/payments";
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

/**
 * Erreur métier du paiement. `code` permet au site de l'afficher dans la langue
 * de l'utilisateur (`checkoutErrors.<code>`) ; `message` reste le texte français
 * renvoyé tel quel par `/api/checkout` à l'application mobile.
 */
export class CheckoutError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export const toStripeAmount = (amount: number, currency: string): number =>
  ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);

/** La session expire au bout de 30 minutes (minimum Stripe) : les dates ne restent pas bloquees. */
const SESSION_TTL_SECONDS = 30 * 60;

/**
 * Kkiapay n'a pas d'expiration de session. Une reservation laissee en
 * `pending_payment` est liberee au bout d'une heure, au prochain passage.
 */
const PENDING_PAYMENT_TTL_MS = 60 * 60 * 1000;

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
  /** Origine publique du site, pour construire la page de paiement Kkiapay. */
  webOrigin?: string;
  /** Stripe par defaut : les appels existants restent inchanges. */
  provider?: PaymentProvider;
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
  webOrigin,
  provider = "stripe",
}: CheckoutInput) {
  if (!listingId || !checkIn || !checkOut) {
    throw new CheckoutError("incomplete", "Données de réservation incomplètes.");
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
    throw new CheckoutError("profile_incomplete", "Complétez votre profil avant de réserver.");
  }

  const { data, error } = await admin
    .from("listings")
    .select(
      "id, title, host_id, price_per_night, currency, transaction_type, status, listing_photos(public_url, storage_path, position)"
    )
    .eq("id", listingId)
    .single();

  const listing = data as unknown as ListingRow | null;

  if (error || !listing) throw new CheckoutError("listing_not_found", "Annonce introuvable.");
  if (listing.status !== "published") {
    throw new CheckoutError("listing_unavailable", "Cette annonce n’est pas disponible.");
  }
  if (listing.transaction_type !== "booking") {
    throw new CheckoutError("not_bookable", "Cette annonce n’est pas réservable en ligne.");
  }
  if (listing.host_id === userId) {
    throw new CheckoutError("own_listing", "Vous ne pouvez pas réserver votre propre bien.");
  }
  if (provider === "kkiapay" && listing.currency.toUpperCase() !== "XOF") {
    throw new Error(
      "Kkiapay accepte uniquement les paiements en XOF. Choisissez Stripe pour cette annonce."
    );
  }

  const start = toDate(checkIn);
  const end = toDate(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new CheckoutError("invalid_dates", "Dates invalides.");
  }

  // Meme regle que le web : les deux journees bornes sont comptees.
  const nightCount = Math.max(differenceInCalendarDays(end, start) + 1, 1);
  const totalPrice = nightCount * listing.price_per_night;

  // Kkiapay n'expire pas la session de paiement. Sans ce menage, une
  // reservation abandonnee bloquerait les dates indefiniment.
  await admin
    .from("bookings")
    .update({ status: "cancelled_by_guest" })
    .eq("listing_id", listingId)
    .eq("status", "pending_payment")
    .lt("created_at", new Date(Date.now() - PENDING_PAYMENT_TTL_MS).toISOString());

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
    throw new CheckoutError("dates_taken", "Ces dates viennent d’être réservées. Choisissez-en d’autres.");
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
  const rawImage = sortedPhotos[0]?.public_url;
  const image =
    typeof rawImage === "string" && (rawImage.startsWith("http://") || rawImage.startsWith("https://"))
      ? rawImage
      : undefined;

  try {
    if (provider === "kkiapay") {
      const origin = (webOrigin ?? process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(
        /\/+$/,
        ""
      );
      if (!origin) {
        throw new CheckoutError("missing_origin", "URL du site manquante pour le paiement Kkiapay.");
      }

      // Le widget vit sur une page du site : le mobile y ouvre le navigateur
      // système, comme pour Stripe. Les URL de retour sont validées par la page.
      const params = new URLSearchParams({
        success: successUrl,
        cancel: cancelUrl,
      });

      return {
        url: `${origin}/paiement/kkiapay/${booking.id}?${params.toString()}`,
        bookingId: booking.id,
        totalPrice,
        nightCount,
        provider,
      };
    }

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

    return {
      url: session.url,
      bookingId: booking.id,
      totalPrice,
      nightCount,
      provider,
    };
  } catch (checkoutError) {
    // Pas de session de paiement : la reservation ne doit pas bloquer le creneau.
    await admin
      .from("bookings")
      .update({ status: "cancelled_by_guest" })
      .eq("id", booking.id);
    throw checkoutError;
  }
}

/**
 * Paiement confirme : seul le webhook appelle cette fonction.
 *
 * Le paiement est enregistre **avant** le changement de statut, et de facon
 * idempotente : un rejeu du webhook ne cree pas de doublon et ne reecrit pas un
 * remboursement deja enregistre.
 *
 * La reservation n'est confirmee que si elle est encore `pending_payment`. Si le
 * voyageur l'a annulee entre-temps (retour depuis Stripe, expiration), elle
 * reste annulee : le paiement est tout de meme trace pour que l'equipe puisse
 * rembourser. On ne ressuscite jamais une reservation annulee.
 */
export async function confirmBooking(
  bookingId: string,
  session: Stripe.Checkout.Session
) {
  const admin = createAdminClient();

  const { data: booking, error } = await admin
    .from("bookings")
    .select("id, guest_id, total_price, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    throw new Error(error?.message || "Reservation introuvable.");
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const { error: paymentError } = await admin.from("payments").upsert(
    {
      booking_id: booking.id,
      user_id: booking.guest_id,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntent ?? null,
      amount: booking.total_price,
      currency: session.currency ?? "usd",
      status: "paid",
    },
    { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true }
  );

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  return confirmPendingBooking(booking, "stripe");
}

/**
 * Paiement Kkiapay verifie cote serveur.
 *
 * `transaction` vient de l'API Kkiapay, jamais du client. Le `partnerId` porte
 * l'identifiant de la reservation : c'est lui qui rattache le paiement au bon
 * sejour. Le montant est compare au total calcule a la creation.
 *
 * Aucune reservation n'est confirmee si le lien avec la transaction est absent :
 * un paiement ne doit jamais pouvoir etre reutilise sur une autre reservation.
 */
export async function confirmKkiapayPayment(
  bookingId: string,
  transaction: KkiapayTransaction
) {
  const admin = createAdminClient();

  const { data: booking, error } = await admin
    .from("bookings")
    .select("id, guest_id, total_price, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    throw new Error(error?.message || "Reservation introuvable.");
  }

  if (
    transaction.status !== "SUCCESS" &&
    transaction.status !== "COMPLETE" &&
    transaction.status !== "COMPLETED"
  ) {
    throw new CheckoutError("kkiapay_failed", "Le paiement Kkiapay n’a pas abouti.");
  }

  if (Number(transaction.amount) !== booking.total_price) {
    throw new CheckoutError("amount_mismatch", "Le montant du paiement ne correspond pas à la réservation.");
  }

  const linkedBookingId = transaction.partnerId || transaction.data;
  if (linkedBookingId !== bookingId) {
    throw new CheckoutError("unlinked_payment", "Impossible de rattacher ce paiement à la réservation.");
  }

  const { error: paymentError } = await admin.from("payments").upsert(
    {
      booking_id: booking.id,
      user_id: booking.guest_id,
      provider: "kkiapay",
      provider_transaction_id: transaction.transactionId,
      amount: booking.total_price,
      currency: "XOF",
      status: "paid",
    },
    {
      onConflict: "provider,provider_transaction_id",
      ignoreDuplicates: true,
    }
  );

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  return confirmPendingBooking(booking, "kkiapay");
}

/**
 * Confirmation de secours en sandbox, sans cles serveur Kkiapay.
 *
 * Le widget ne renvoie qu'un identifiant de transaction : sans cle privee ni
 * secret, Kkiapay ne peut pas confirmer le paiement. En sandbox uniquement, on
 * accepte donc le retour du widget pour permettre de tester le parcours de bout
 * en bout. La page de paiement refuse ce chemin en production : aucun vrai
 * paiement ne peut etre confirme sans verification serveur.
 *
 * Le paiement est tout de meme trace, avec l'identifiant de transaction prefixe
 * `sandbox:`, pour que l'equipe puisse le rapprocher du tableau de bord Kkiapay
 * sans le confondre avec un paiement verifie.
 */
export async function confirmKkiapaySandboxPayment(
  bookingId: string,
  transactionId: string
) {
  if (!isKkiapaySandbox()) {
    throw new Error(
      "La confirmation sans verification Kkiapay est reservee au sandbox."
    );
  }

  const admin = createAdminClient();

  const { data: booking, error } = await admin
    .from("bookings")
    .select("id, guest_id, total_price, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    throw new Error(error?.message || "Reservation introuvable.");
  }

  const { error: paymentError } = await admin.from("payments").upsert(
    {
      booking_id: booking.id,
      user_id: booking.guest_id,
      provider: "kkiapay",
      // Prefixe explicite : la ligne est identifiable comme non verifiee.
      provider_transaction_id: `sandbox:${transactionId}`,
      amount: booking.total_price,
      currency: "XOF",
      status: "paid",
    },
    {
      onConflict: "provider,provider_transaction_id",
      ignoreDuplicates: true,
    }
  );

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  console.warn(
    "[kkiapay] confirmation sandbox sans verification serveur",
    booking.id,
    transactionId
  );

  return confirmPendingBooking(booking, "kkiapay");
}

/**
 * Confirme une reservation encore en attente, de facon idempotente.
 *
 * Un rejeu normal retombe sur `confirmed`. Tout autre statut signifie que la
 * reservation a ete annulee, terminee ou remboursee avant l'arrivee du
 * paiement : on le signale, on ne l'ecrase jamais.
 */
async function confirmPendingBooking(
  booking: { id: string; status: string },
  provider: PaymentProvider
) {
  if (booking.status !== "pending_payment") {
    if (booking.status !== "confirmed") {
      console.warn(
        `[${provider}] paiement recu pour une reservation non en attente`,
        booking.id,
        booking.status
      );
    }

    return {
      confirmed: booking.status === "confirmed",
      previousStatus: booking.status,
    };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", booking.id)
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    confirmed: Boolean(updated),
    previousStatus: booking.status,
  };
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
