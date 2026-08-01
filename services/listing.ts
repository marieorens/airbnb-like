"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { LISTINGS_BATCH } from "@/utils/constants";
import { getCurrentUser } from "./user";
import type { Listing } from "@/types/listing";
import type { Tables } from "@/types/supabase";

type ListingPhotoRow = Pick<
  Tables<"listing_photos">,
  "storage_path" | "public_url" | "position"
>;

type ListingBookingRow = Pick<
  Tables<"bookings">,
  "check_in" | "check_out" | "status"
>;

type ListingProfileRow = Pick<Tables<"profiles">, "full_name" | "avatar_url">;

type ListingQueryRow = Tables<"listings"> & {
  listing_photos?: ListingPhotoRow[] | null;
  bookings?: ListingBookingRow[] | null;
  profiles?: ListingProfileRow | null;
};

const listingSelect = `
  *,
  profiles(full_name, avatar_url),
  listing_photos(storage_path, public_url, position),
  bookings(check_in, check_out, status)
`;

const toDate = (value: string) => new Date(`${value}T00:00:00`);
const normalizeSupabaseUrl = (url: string) =>
  url.replace(/\.supabase\.co\/rest\/v1\//, ".supabase.co/");

const hasDateConflict = (
  bookings: ListingBookingRow[] | null | undefined,
  startDate?: string | string[] | null,
  endDate?: string | string[] | null
) => {
  if (!startDate || !endDate || Array.isArray(startDate) || Array.isArray(endDate)) {
    return false;
  }

  const requestedStart = toDate(startDate);
  const requestedEnd = toDate(endDate);

  return (bookings ?? [])
    .filter((booking) => !booking.status.startsWith("cancelled"))
    .some((booking) => {
      const bookedStart = toDate(booking.check_in);
      const bookedEnd = toDate(booking.check_out);
      return bookedStart <= requestedEnd && bookedEnd >= requestedStart;
    });
};

export const mapListing = (row: ListingQueryRow): Listing => {
  const photo = [...(row.listing_photos ?? [])].sort(
    (a, b) => a.position - b.position
  )[0];

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageSrc: normalizeSupabaseUrl(
      photo?.public_url ||
        photo?.storage_path ||
        "/images/placeholder.jpg"
    ),
    createdAt: new Date(row.created_at),
    category: row.category,
    roomCount: row.room_count,
    bathroomCount: row.bathroom_count,
    guestCount: row.guest_count,
    userId: row.host_id,
    price: row.price_per_night,
    country: row.country,
    latlng: [row.latitude ?? 0, row.longitude ?? 0],
    region: row.region,
    user: row.profiles
      ? {
          name: row.profiles.full_name,
          image: row.profiles.avatar_url,
        }
      : undefined,
    reservations: (row.bookings ?? [])
      .filter((booking) => !booking.status.startsWith("cancelled"))
      .map((booking) => ({
        startDate: toDate(booking.check_in),
        endDate: toDate(booking.check_out),
      })),
  };
};

async function applyCursor(cursor?: string | string[] | null) {
  if (!cursor || Array.isArray(cursor)) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("listings")
    .select("created_at")
    .eq("id", cursor)
    .single();

  return data?.created_at ?? null;
}

export const getListings = async (query?: {
  [key: string]: string | string[] | undefined | null;
}) => {
  try {
    const {
      userId,
      roomCount,
      guestCount,
      bathroomCount,
      country,
      startDate,
      endDate,
      category,
      cursor,
    } = query || {};

    const supabase = createClient();
    let request = supabase
      .from("listings")
      .select(listingSelect)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(LISTINGS_BATCH);

    if (userId && !Array.isArray(userId)) request = request.eq("host_id", userId);
    if (category && !Array.isArray(category)) request = request.eq("category", category);
    if (roomCount && !Array.isArray(roomCount)) request = request.gte("room_count", Number(roomCount));
    if (guestCount && !Array.isArray(guestCount)) request = request.gte("guest_count", Number(guestCount));
    if (bathroomCount && !Array.isArray(bathroomCount)) request = request.gte("bathroom_count", Number(bathroomCount));
    if (country && !Array.isArray(country)) request = request.eq("country", country);

    const cursorCreatedAt = await applyCursor(cursor);
    if (cursorCreatedAt) request = request.lt("created_at", cursorCreatedAt);

    const { data, error } = await request;
    if (error) throw error;

    const rows = (data ?? []) as unknown as ListingQueryRow[];
    const listings = rows
      .filter((row) => !hasDateConflict(row.bookings, startDate, endDate))
      .map(mapListing);

    const nextCursor =
      listings.length === LISTINGS_BATCH ? listings[LISTINGS_BATCH - 1].id : null;

    return { listings, nextCursor };
  } catch {
    return {
      listings: [],
      nextCursor: null,
    };
  }
};

export const getListingsByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(listingSelect)
    .in("id", ids)
    .eq("status", "published");

  if (error) throw error;

  const listings = ((data ?? []) as unknown as ListingQueryRow[]).map(mapListing);
  return ids
    .map((id) => listings.find((listing) => listing.id === id))
    .filter((listing): listing is Listing => Boolean(listing));
};

export const getListingById = async (id: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(listingSelect)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapListing(data as unknown as ListingQueryRow);
};

export const createListing = async (data: { [x: string]: unknown }) => {
  const category = String(data.category || "");
  const location = data.location as
    | { region?: string; label?: string; latlng?: number[] }
    | null
    | undefined;
  const guestCount = Number(data.guestCount || 1);
  const bathroomCount = Number(data.bathroomCount || 1);
  const roomCount = Number(data.roomCount || 1);
  const image = String(data.image || "");
  const price = Number(data.price || 0);
  const title = String(data.title || "");
  const description = String(data.description || "");

  if (!category || !location || !image || !price || !title || !description) {
    throw new Error("Invalid data");
  }

  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized!");

  const supabase = createClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      title,
      description,
      category,
      room_count: roomCount,
      bathroom_count: bathroomCount,
      guest_count: guestCount,
      country: location.label ?? null,
      region: location.region ?? null,
      latitude: location.latlng?.[0] ?? null,
      longitude: location.latlng?.[1] ?? null,
      price_per_night: price,
      host_id: user.id,
      status: "published",
    })
    .select()
    .single();

  if (error || !listing) throw new Error(error?.message || "Failed to create listing");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_host: true })
    .eq("id", user.id);

  if (profileError) throw new Error(profileError.message);

  const { error: photoError } = await supabase.from("listing_photos").insert({
    listing_id: listing.id,
    storage_path: image,
    public_url: image,
    alt_text: title,
    position: 0,
  });

  if (photoError) throw new Error(photoError.message);

  revalidatePath("/");
  revalidatePath("/properties");

  return mapListing({
    ...listing,
    listing_photos: [{ storage_path: image, public_url: image, position: 0 }],
    bookings: [],
    profiles: { full_name: user.name, avatar_url: user.image },
  });
};
