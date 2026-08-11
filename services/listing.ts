import { createClient } from "@/lib/supabase/server";
import { assetTypes, LISTINGS_BATCH } from "@/utils/constants";
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

const transactionTypes = ["booking", "rent", "sale", "lead"] as const;

const isAssetType = (
  value: string
): value is Tables<"listings">["asset_type"] =>
  assetTypes.some((asset) => asset.value === value);

const isTransactionType = (
  value: string
): value is Tables<"listings">["transaction_type"] =>
  transactionTypes.some((transaction) => transaction === value);

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
  const photos = [...(row.listing_photos ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((photo) => ({
      publicUrl: normalizeSupabaseUrl(
        photo.public_url || photo.storage_path || "/images/placeholder.jpg"
      ),
      position: photo.position,
    }));
  const photo = photos[0];

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageSrc: photo?.publicUrl || "/images/placeholder.jpg",
    photos: photos.length
      ? photos
      : [{ publicUrl: "/images/placeholder.jpg", position: 0 }],
    createdAt: new Date(row.created_at),
    category: row.category,
    roomCount: row.room_count,
    bathroomCount: row.bathroom_count,
    guestCount: row.guest_count,
    userId: row.host_id,
    price: row.price_per_night,
    assetType: row.asset_type,
    transactionType: row.transaction_type,
    currency: row.currency,
    salePrice: row.sale_price,
    monthlyRent: row.monthly_rent,
    areaSqm: row.area_sqm,
    landTitleStatus: row.land_title_status,
    propertyCondition: row.property_condition,
    availableFrom: row.available_from,
    addressDetails: row.address_details,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactWhatsapp: row.contact_whatsapp,
    contactEmail: row.contact_email,
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
      assetType,
      transactionType,
      minPrice,
      maxPrice,
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
    if (assetType && !Array.isArray(assetType) && isAssetType(assetType)) {
      request = request.eq("asset_type", assetType);
    }
    if (
      transactionType &&
      !Array.isArray(transactionType) &&
      isTransactionType(transactionType)
    ) {
      request = request.eq("transaction_type", transactionType);
    }
    if (minPrice && !Array.isArray(minPrice)) {
      request = request.gte("price_per_night", Number(minPrice));
    }
    if (maxPrice && !Array.isArray(maxPrice)) {
      request = request.lte("price_per_night", Number(maxPrice));
    }
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
