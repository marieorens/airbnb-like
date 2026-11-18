"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import {
  hasKkiapayVerificationKeys,
  isKkiapaySandbox,
  verifyKkiapayTransaction,
} from "@/lib/kkiapay";
import type { PaymentProvider } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import {
  confirmKkiapayPayment,
  confirmKkiapaySandboxPayment,
  createCheckout,
  CheckoutError,
} from "./checkout";
import { localizePath } from "@/i18n/routing";
import { getCurrentUser } from "./user";

export const deleteReservation = async (reservationId: string) => {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Connexion requise.");
  }

  if (!reservationId || typeof reservationId !== "string") {
    throw new Error("Invalid ID");
  }

  const supabase = createClient();
  const { data: reservation, error: reservationError } = await supabase
    .from("bookings")
    .select("id, listing_id, guest_id, host_id")
    .eq("id", reservationId)
    .single();

  if (reservationError || !reservation) {
    throw new Error("Reservation introuvable.");
  }

  const status =
    reservation.host_id === currentUser.id ? "cancelled_by_host" : "cancelled_by_guest";

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", reservationId);

  if (error) throw new Error(error.message);

  // Toutes les langues (`/trips`, `/en/trips`…) : on invalide tout le site.
  revalidatePath("/", "layout");

  return reservation;
};

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Paiement depuis le site web.
 *
 * Toute la logique vit dans `createCheckout`, partagee avec la route
 * `/api/checkout` utilisee par l'application mobile. `totalPrice` n'est plus
 * lu : le montant est recalcule cote serveur a partir du prix de l'annonce.
 *
 * Les erreurs metier sont renvoyees dans `error` plutot que levees : en
 * production, Next masque le message d'une Server Action qui leve, et
 * l'utilisateur ne voit qu'une erreur generique.
 */
export const createPaymentSession = async ({
  listingId,
  startDate,
  endDate,
  provider = "stripe",
}: {
  listingId: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  provider?: PaymentProvider;
}): Promise<{ url?: string; error?: string }> => {
  const t = await getTranslations("checkoutErrors");
  const locale = await getLocale();

  if (!listingId || !startDate || !endDate) {
    return { error: t("invalid_dates") };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: t("sign_in") };
  }

  if (!user.isProfileComplete) {
    return { error: t("profile_incomplete") };
  }

  const reqHeaders = headers();
  const host = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host");
  const proto = reqHeaders.get("x-forwarded-proto") || "http";
  const envOrigin = (process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(/\/+$/, "");
  const origin = host ? `${proto}://${host}` : envOrigin;

  try {
    const { url } = await createCheckout({
      userId: user.id,
      listingId,
      checkIn: toDateString(startDate),
      checkOut: toDateString(endDate),
      successUrl: `${origin}${localizePath("/trips", locale)}`,
      cancelUrl: `${origin}${localizePath(`/listings/${listingId}`, locale)}`,
      webOrigin: origin,
      provider,
    });

    // Toutes les langues (`/trips`, `/en/trips`…) : on invalide tout le site.
    revalidatePath("/", "layout");

    if (!url) {
      return { error: t("generic") };
    }

    return { url };
  } catch (error) {
    // Erreur métier connue : message traduit. Sinon, message générique (pas de détail technique).
    const code = error instanceof CheckoutError ? error.code : "generic";
    return { error: t.has(code) ? t(code) : t("generic") };
  }
};

/**
 * Verification serveur d'un paiement Kkiapay.
 *
 * Appelee par la page de paiement apres le retour du widget. Le client ne
 * transmet qu'une reference de transaction : le statut et le montant sont
 * relus chez Kkiapay avec les cles serveur. Sans ces cles, la reservation
 * reste en attente — sauf en sandbox, ou le retour du widget suffit pour
 * tester le parcours (voir `confirmKkiapaySandboxPayment`).
 */
export const verifyKkiapayPayment = async ({
  bookingId,
  transactionId,
}: {
  bookingId: string;
  transactionId: string;
}) => {
  const t = await getTranslations("checkoutErrors");

  if (!bookingId || !transactionId) {
    throw new Error(t("incomplete_payment"));
  }

  if (!hasKkiapayVerificationKeys()) {
    /*
     * Sans cle privee ni secret, Kkiapay ne peut pas verifier la transaction.
     * En sandbox, on confirme a partir du retour du widget pour ne pas bloquer
     * les tests. En production, la page de paiement n'ouvre jamais le widget
     * dans cet etat : ce chemin ne peut donc pas encaisser un vrai paiement.
     */
    if (isKkiapaySandbox()) {
      const result = await confirmKkiapaySandboxPayment(
        bookingId,
        transactionId
      );

      return {
        status: result.confirmed ? ("confirmed" as const) : ("recorded" as const),
        message: result.confirmed ? t("sandbox_confirmed") : t("recorded_not_pending"),
      };
    }

    return {
      status: "unconfigured" as const,
      message: t("verification_unconfigured"),
    };
  }

  const transaction = await verifyKkiapayTransaction(transactionId);
  const result = await confirmKkiapayPayment(bookingId, transaction);

  return {
    status: result.confirmed ? ("confirmed" as const) : ("recorded" as const),
    message: result.confirmed ? t("confirmed") : t("recorded_not_pending"),
  };
};

/**
 * Annulation explicite depuis la page de paiement.
 *
 * Reservee au proprietaire de la reservation : la policy RLS de `bookings`
 * fait le tri. Depuis le mobile, le navigateur n'a pas de session — c'est le
 * hook de retour qui libere le creneau apres coup.
 */
export const cancelPendingCheckout = async (bookingId: string) => {
  if (!bookingId) return { cancelled: false };

  const user = await getCurrentUser();
  if (!user) return { cancelled: false };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled_by_guest" })
    .eq("id", bookingId)
    .eq("guest_id", user.id)
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return { cancelled: Boolean(data) };
};
