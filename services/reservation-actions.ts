"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getCurrentUser } from "./user";
import type { Tables } from "@/types/supabase";

type PaymentListingRow = Pick<
  Tables<"listings">,
  "id" | "title" | "price_per_night" | "transaction_type"
> & {
  listing_photos?:
    | Pick<Tables<"listing_photos">, "public_url" | "storage_path" | "position">[]
    | null;
};

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

export const createPaymentSession = async ({
  listingId,
  startDate,
  endDate,
  totalPrice,
}: {
  listingId: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  totalPrice: number;
}) => {
  if (!listingId || !startDate || !endDate || !totalPrice) {
    throw new Error("Invalid data");
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, price_per_night, transaction_type, listing_photos(public_url, storage_path, position)")
    .eq("id", listingId)
    .single();

  const listing = data as unknown as PaymentListingRow | null;

  if (error || !listing) throw new Error("Annonce introuvable.");
  if (listing.transaction_type !== "booking") {
    throw new Error("Cette annonce n'est pas disponible en reservation en ligne.");
  }

  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Veuillez vous connecter pour reserver.");
  }
  if (!user.isProfileComplete) {
    throw new Error("Veuillez completer votre profil avant de reserver.");
  }

  const sortedPhotos = [...(listing.listing_photos ?? [])].sort(
    (a, b) => a.position - b.position
  );
  const image = sortedPhotos[0]?.public_url || sortedPhotos[0]?.storage_path;

  const product = await stripe.products.create({
    name: listing.title,
    images: image ? [image] : undefined,
    default_price_data: {
      currency: "USD",
      unit_amount: totalPrice * 100,
    },
  });

  const stripeSession = await stripe.checkout.sessions.create({
    success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/trips`,
    cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/listings/${listing.id}`,
    payment_method_types: ["card"],
    mode: "payment",
    shipping_address_collection: {
      allowed_countries: ["DE", "US", "NP", "CH", "BH", "AU"],
    },
    metadata: {
      listingId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalPrice: String(totalPrice),
      userId: user.id,
    },
    line_items: [{ price: product.default_price as string, quantity: 1 }],
  });

  return { url: stripeSession.url };
};
