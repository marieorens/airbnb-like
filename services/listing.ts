import { fetchPublicProfiles } from "@/lib/public-profiles";
import { createClient } from "@/lib/supabase/server";
import { assetTypes, currencies, LISTINGS_BATCH } from "@/utils/constants";
import type { Listing } from "@/types/listing";
import { parseTranslations } from "@/utils/listingText";
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
type ListingVirtualTourRow = Pick<
  Tables<"listing_virtual_tours">,
  | "id"
  | "provider"
  | "tour_url"
  | "embed_url"
  | "source_type"
  | "preview_image_url"
  | "room_label"
  | "position"
  | "status"
>;

type ListingQueryRow = Tables<"listings"> & {
  listing_photos?: ListingPhotoRow[] | null;
  listing_virtual_tours?: ListingVirtualTourRow[] | null;
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

const isCurrency = (value: string): value is (typeof currencies)[number] =>
  currencies.some((currency) => currency === value);

const listingSelect = `
  *,
  listing_photos(storage_path, public_url, position),
  listing_virtual_tours(id, provider, tour_url, embed_url, source_type, preview_image_url, room_label, position, status),
  bookings(check_in, check_out, status)
`;

const toDate = (value: string) => new Date(`${value}T00:00:00`);
const normalizeSupabaseUrl = (url: string) =>
  url.replace(/\.supabase\.co\/rest\/v1\//, ".supabase.co/");

/**
 * Date au format AAAA-MM-JJ, ou `null`. Accepte aussi une date ISO complète
 * (`2026-11-18T00:00:00+01:00`), qu'envoyaient les anciens liens de recherche.
 */
const toDayParam = (value?: string | string[] | null): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;

/**
 * Annonces occupées sur la période. Les réservations d'autrui sont illisibles
 * (RLS) : on passe par la fonction `unavailable_listing_ids`, qui ne renvoie que
 * des identifiants d'annonces. Voir la migration 202611180001.
 */
async function getUnavailableListingIds(
  startDate?: string | string[] | null,
  endDate?: string | string[] | null
): Promise<string[]> {
  const start = toDayParam(startDate);
  const end = toDayParam(endDate);
  if (!start || !end || start > end) return [];

  const supabase = createClient();
  const { data, error } = await supabase.rpc("unavailable_listing_ids", {
    start_date: start,
    end_date: end,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Joint le profil public de l'hôte à chaque annonce. `profiles` n'est plus
 * lisible par les autres membres : on passe par la vue `public_profiles`.
 */
async function withHostProfiles(rows: ListingQueryRow[]): Promise<ListingQueryRow[]> {
  const profiles = await fetchPublicProfiles(
    createClient(),
    rows.map((row) => row.host_id)
  );
  return rows.map((row) => {
    const host = profiles.get(row.host_id);
    return {
      ...row,
      profiles: host ? { full_name: host.full_name, avatar_url: host.avatar_url } : null,
    };
  });
}

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
    translations: parseTranslations(row.translations),
    imageSrc: photo?.publicUrl || "/images/placeholder.jpg",
    photos: photos.length
      ? photos
      : [{ publicUrl: "/images/placeholder.jpg", position: 0 }],
    virtualTours: (row.listing_virtual_tours ?? [])
      .filter((tour) => tour.status === "active")
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((tour) => ({
        id: tour.id,
        provider: tour.provider,
        tourUrl: tour.tour_url,
        embedUrl: tour.embed_url,
        sourceType:
          tour.source_type ?? (tour.provider === "panorama" ? "panorama" : "external"),
        previewImageUrl: tour.preview_image_url,
        roomLabel: tour.room_label,
        position: tour.position ?? 0,
        status: tour.status,
      })),
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
    city: row.city,
    district: row.district,
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
      region,
      currency,
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
    const unavailableIds = await getUnavailableListingIds(startDate, endDate);
    // Le client Supabase modifie la requête sur place : on en construit une neuve à chaque lot.
    const buildRequest = () => {
      let request = supabase
        .from("listings")
        .select(listingSelect)
        .eq("status", "published")
        .order("created_at", { ascending: false });

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
      // Un prix n'a de sens que dans une devise : 100 XOF et 100 EUR ne se comparent pas.
      // Les bornes de prix ne s'appliquent donc que si une devise est choisie.
      const activeCurrency =
        currency && !Array.isArray(currency) && isCurrency(currency) ? currency : null;
      if (activeCurrency) {
        request = request.eq("currency", activeCurrency);
        if (minPrice && !Array.isArray(minPrice) && Number(minPrice) > 0) {
          request = request.gte("price_per_night", Number(minPrice));
        }
        if (maxPrice && !Array.isArray(maxPrice) && Number(maxPrice) > 0) {
          request = request.lte("price_per_night", Number(maxPrice));
        }
      }
      if (roomCount && !Array.isArray(roomCount)) request = request.gte("room_count", Number(roomCount));
      if (guestCount && !Array.isArray(guestCount)) request = request.gte("guest_count", Number(guestCount));
      if (bathroomCount && !Array.isArray(bathroomCount)) request = request.gte("bathroom_count", Number(bathroomCount));
      if (country && !Array.isArray(country)) request = request.eq("country", country);
      if (region && !Array.isArray(region)) request = request.eq("region", region);
      if (unavailableIds.length) {
        request = request.not("id", "in", `(${unavailableIds.join(",")})`);
      }
      return request;
    };

    // Tous les filtres, dates comprises, sont appliqués par la base : un lot
    // complet signifie qu'il peut rester des annonces après lui.
    const cursorCreatedAt = await applyCursor(cursor);
    let request = buildRequest().limit(LISTINGS_BATCH);
    if (cursorCreatedAt) request = request.lt("created_at", cursorCreatedAt);

    const { data, error } = await request;
    if (error) throw error;

    const rows = (data ?? []) as unknown as ListingQueryRow[];
    const listings: Listing[] = (await withHostProfiles(rows)).map(mapListing);
    const hasMore = rows.length === LISTINGS_BATCH;

    return { listings, nextCursor: hasMore ? (rows[rows.length - 1]?.id ?? null) : null };
  } catch {
    return {
      listings: [],
      nextCursor: null,
    };
  }
};

type ListingsQuery = { [key: string]: string | undefined };

// Ordre d'élargissement quand une recherche ne renvoie rien : on retire d'abord les critères
// les plus restrictifs, et on garde le plus longtemps possible l'intention (type de bien, transaction).
// `id` renvoie au libellé `catalogue.alternatives.relaxed.<id>` (messages/*.json).
const relaxationSteps = [
  { keys: ["startDate", "endDate"], id: "dates" },
  { keys: ["minPrice", "maxPrice", "currency"], id: "price" },
  { keys: ["roomCount", "bathroomCount", "guestCount"], id: "capacity" },
  { keys: ["category"], id: "category" },
  { keys: ["region"], id: "region" },
  { keys: ["country"], id: "country" },
  { keys: ["assetType"], id: "assetType" },
  { keys: ["transactionType"], id: "transactionType" },
] as const;

export type RelaxationStepId = (typeof relaxationSteps)[number]["id"];

const ALTERNATIVES_LIMIT = 8;

/**
 * Propose des annonces proches quand la recherche exacte est vide.
 * Retourne aussi les critères retirés et le lien vers la recherche élargie.
 */
export const getAlternativeListings = async (query: ListingsQuery = {}) => {
  const relaxed: ListingsQuery = { ...query };
  delete relaxed.cursor;
  const removedKeys: RelaxationStepId[] = [];

  for (const step of relaxationSteps) {
    if (!step.keys.some((key) => relaxed[key])) continue;

    step.keys.forEach((key) => delete relaxed[key]);
    removedKeys.push(step.id);

    const { listings } = await getListings(relaxed);
    if (listings.length > 0) {
      const params = new URLSearchParams();
      Object.entries(relaxed).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const queryString = params.toString();

      return {
        listings: listings.slice(0, ALTERNATIVES_LIMIT),
        removedKeys,
        href: queryString ? `/annonces?${queryString}` : "/annonces",
      };
    }
  }

  return { listings: [] as Listing[], removedKeys, href: "/annonces" };
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

  const listings = (await withHostProfiles((data ?? []) as unknown as ListingQueryRow[])).map(
    mapListing
  );
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

  const [row] = await withHostProfiles([data as unknown as ListingQueryRow]);
  return mapListing(row);
};

/** Rayon de recherche « Autour de moi », en kilomètres. */
export const NEARBY_RADIUS_KM = 100;

/**
 * Annonces publiées les plus proches d'un point, de la plus proche à la plus
 * éloignée, avec leur distance. Voir la fonction SQL `listings_near`.
 */
export const getNearbyListings = async (lat: number, lng: number) => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("listings_near", {
    lat,
    lng,
    radius_km: NEARBY_RADIUS_KM,
    max_results: 48,
  });
  if (error || !data?.length) return [];

  const listings = await getListingsByIds(data.map((row) => row.listing_id));
  const distanceById = new Map(data.map((row) => [row.listing_id, row.distance_km]));
  return listings.map((listing) => ({
    listing,
    distanceKm: distanceById.get(listing.id) ?? 0,
  }));
};
