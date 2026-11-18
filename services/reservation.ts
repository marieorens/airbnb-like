
import { fetchPublicProfiles } from "@/lib/public-profiles";
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
      status: booking.status,
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

    const rawRows = (data ?? []) as unknown as BookingWithListing[];
    // `profiles` n'est plus lisible par les autres membres : profil public de l'hôte.
    const hosts = await fetchPublicProfiles(
      supabase,
      rawRows.map((row) => row.listings?.host_id)
    );
    const rows = rawRows.map((row) => {
      const host = row.listings ? hosts.get(row.listings.host_id) : undefined;
      return row.listings && host
        ? {
            ...row,
            listings: {
              ...row.listings,
              profiles: { full_name: host.full_name, avatar_url: host.avatar_url },
            },
          }
        : row;
    });
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
