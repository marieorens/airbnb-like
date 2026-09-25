"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createCheckout } from "./checkout";
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

  revalidatePath("/reservations");
  revalidatePath(`/listings/${reservation.listing_id}`);
  revalidatePath("/trips");

  return reservation;
};

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Paiement depuis le site web.
 *
 * Toute la logique vit dans `createCheckout`, partagee avec la route
 * `/api/checkout` utilisee par l'application mobile. `totalPrice` n'est plus
 * lu : le montant est recalcule cote serveur a partir du prix de l'annonce.
 */
export const createPaymentSession = async ({
  listingId,
  startDate,
  endDate,
}: {
  listingId: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  totalPrice?: number;
}) => {
  if (!listingId || !startDate || !endDate) {
    throw new Error("Invalid data");
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Veuillez vous connecter pour reserver.");
  }

  const origin = (process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(/\/+$/, "");

  const { url } = await createCheckout({
    userId: user.id,
    listingId,
    checkIn: toDateString(startDate),
    checkOut: toDateString(endDate),
    successUrl: `${origin}/trips`,
    cancelUrl: `${origin}/listings/${listingId}`,
  });

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/trips");

  return { url };
};
