import { differenceInCalendarDays } from "date-fns";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { LISTINGS_BATCH } from "@/utils/constants";
import { mapListing } from "./listing";
import type { Listing } from "@/types/listing";
import type { Tables } from "@/types/supabase";

type BookingWithListing = Tables<"bookings"> & {
  listings:
    | (Tables<"listings"> & {
        profiles?: Pick<Tables<"profiles">, "full_name" | "avatar_url"> | null;
        listing_photos?:
          | Pick<Tables<"listing_photos">, "storage_path" | "public_url" | "position">[]
          | null;
      })
    | null;
};

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

const toReservationListing = (booking: BookingWithListing): Listing | null => {
  if (!booking.listings) return null;

  return {
    ...mapListing({
      ...booking.listings,
      profiles: booking.listings.profiles ?? null,
      listing_photos: booking.listings.listing_photos ?? [],
      bookings: [],
    }),
    reservation: {
      id: booking.id,
      startDate: new Date(`${booking.check_in}T00:00:00`),
      endDate: new Date(`${booking.check_out}T00:00:00`),
      totalPrice: booking.total_price,
    },
  };
};

export const getReservations = async (args: Record<string, string | undefined>) => {
  try {
    const { listingId, userId, authorId, cursor } = args;
    const supabase = createClient();

    let request = supabase
      .from("bookings")
      .select(
        `
        *,
        listings(
          *,
          profiles(full_name, avatar_url),
          listing_photos(storage_path, public_url, position)
        )
      `
      )
      .not("status", "in", '("cancelled_by_guest","cancelled_by_host","refunded")')
      .order("created_at", { ascending: false })
      .limit(LISTINGS_BATCH);

    if (userId) request = request.eq("guest_id", userId);
    if (authorId) request = request.eq("host_id", authorId);
    if (listingId) request = request.eq("listing_id", listingId);

    if (cursor) {
      const { data: cursorBooking } = await supabase
        .from("bookings")
        .select("created_at")
        .eq("id", cursor)
        .single();

      if (cursorBooking?.created_at) {
        request = request.lt("created_at", cursorBooking.created_at);
      }
    }

    const { data, error } = await request;
    if (error) throw error;

    const rows = (data ?? []) as unknown as BookingWithListing[];
    const listings = rows
      .map(toReservationListing)
      .filter((listing): listing is Listing => Boolean(listing));

    const nextCursor =
      rows.length === LISTINGS_BATCH ? rows[LISTINGS_BATCH - 1].id : null;

    return {
      listings,
      nextCursor,
    };
  } catch {
    return {
      listings: [],
      nextCursor: null,
    };
  }
};

export const createReservation = async ({
  listingId,
  startDate,
  endDate,
  totalPrice,
  userId,
  stripeSession,
}: {
  listingId: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  totalPrice: number;
  userId: string;
  stripeSession?: Stripe.Checkout.Session;
}) => {
  if (!listingId || !startDate || !endDate || !totalPrice || !userId) {
    throw new Error("Invalid data");
  }

  const admin = createAdminClient();
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("host_id, price_per_night")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) throw new Error("Annonce introuvable.");

  const nightCount = Math.max(differenceInCalendarDays(endDate, startDate) + 1, 1);

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .insert({
      listing_id: listingId,
      guest_id: userId,
      host_id: listing.host_id,
      check_in: toDateString(startDate),
      check_out: toDateString(endDate),
      night_count: nightCount,
      price_per_night: listing.price_per_night,
      total_price: totalPrice,
      status: "confirmed",
    })
    .select()
    .single();

  if (bookingError || !booking) {
    throw new Error(bookingError?.message || "Failed to create reservation");
  }

  if (stripeSession) {
    const paymentIntent =
      typeof stripeSession.payment_intent === "string"
        ? stripeSession.payment_intent
        : stripeSession.payment_intent?.id;

    await admin.from("payments").insert({
      booking_id: booking.id,
      user_id: userId,
      stripe_checkout_session_id: stripeSession.id,
      stripe_payment_intent_id: paymentIntent ?? null,
      amount: totalPrice,
      currency: stripeSession.currency ?? "usd",
      status: "paid",
    });
  }

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/trips");
  revalidatePath("/reservations");

  return booking;
};
