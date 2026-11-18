"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./user";
import { translateListingText } from "@/lib/listing-translation";

import { mapListing } from "./listing";
import { assetTypes } from "@/utils/constants";
import {
  normalizePanoramaVirtualTourUrl,
  normalizeVirtualTourUrl,
} from "@/utils/virtualTour";

type PanoramaInput = {
  url?: unknown;
  label?: unknown;
};

export const createListing = async (data: { [x: string]: unknown }) => {
  const requestedAssetType = String(data.assetType || "short_stay");
  const asset = assetTypes.find((item) => item.value === requestedAssetType);
  const transactionType = asset?.transactionType ?? "booking";
  const category = String(data.category || "");
  const location = data.location as
    | { region?: string; label?: string; latlng?: number[] }
    | null
    | undefined;
  const guestCount = Number(data.guestCount || 1);
  const bathroomCount = Number(data.bathroomCount || 1);
  const roomCount = Number(data.roomCount || 1);
  const images = Array.isArray(data.images)
    ? data.images.map((item) => String(item)).filter(Boolean)
    : String(data.image || "")
    ? [String(data.image)]
    : [];
  const image = images[0] ?? "";
  const price = Number(data.price || 0);
  const salePrice = Number(data.salePrice || 0);
  const monthlyRent = Number(data.monthlyRent || 0);
  const areaSqm = Number(data.areaSqm || 0);
  const currency = String(data.currency || "USD");
  const landTitleStatus = String(data.landTitleStatus || "");
  const propertyCondition = String(data.propertyCondition || "");
  const availableFrom = String(data.availableFrom || "");
  const addressDetails = String(data.addressDetails || "").trim().slice(0, 300);
  const city = String(data.city || "").trim().slice(0, 120);
  const district = String(data.district || "").trim().slice(0, 120);
  // Repère placé sur la carte par l'annonceur : [latitude, longitude].
  const coordinates = Array.isArray(data.coordinates)
    ? data.coordinates.map(Number)
    : [];
  const [latitude, longitude] = coordinates;
  const hasValidCoordinates =
    coordinates.length === 2 &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const title = String(data.title || "");
  const description = String(data.description || "");
  const virtualTourMode = String(data.virtualTourMode || "external");
  const virtualTourPanoramas = Array.isArray(data.virtualTourPanoramas)
    ? (data.virtualTourPanoramas as PanoramaInput[])
        .map((item, index) => {
          const normalized = normalizePanoramaVirtualTourUrl(String(item.url || ""));
          if (!normalized) return null;

          return {
            ...normalized,
            roomLabel: String(item.label || `Piece ${index + 1}`).trim(),
            position: index,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  const virtualTour =
    virtualTourMode === "panorama"
      ? null
      : normalizeVirtualTourUrl(String(data.virtualTourUrl || ""));
  const virtualTours =
    virtualTourMode === "panorama" ? virtualTourPanoramas : virtualTour ? [virtualTour] : [];
  const displayPrice =
    transactionType === "sale"
      ? salePrice
      : transactionType === "rent"
      ? monthlyRent
      : price;

  if (
    !asset ||
    !location ||
    !city ||
    !hasValidCoordinates ||
    images.length < 3 ||
    !displayPrice ||
    !title ||
    !description
  ) {
    throw new Error("Invalid data");
  }

  const listingCategory = category || asset.label;

  const user = await getCurrentUser();
  if (!user) throw new Error("Connexion requise.");
  if (!user.isProfileComplete) {
    throw new Error("Completez votre profil avant de publier un bien.");
  }
  // Publier exige un compte validé par la modération (vérification d'identité).
  if (!user.isVerified) {
    throw new Error("Votre compte doit être vérifié avant de publier un bien.");
  }

  const supabase = createClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      title,
      description,
      category: listingCategory,
      room_count: roomCount,
      bathroom_count: bathroomCount,
      guest_count: guestCount,
      country: location.label ?? null,
      region: location.region ?? null,
      city,
      district: district || null,
      latitude,
      longitude,
      price_per_night: displayPrice,
      asset_type: asset.value,
      transaction_type: transactionType,
      currency,
      sale_price: transactionType === "sale" ? salePrice : null,
      monthly_rent: transactionType === "rent" ? monthlyRent : null,
      area_sqm: areaSqm > 0 ? areaSqm : null,
      land_title_status: landTitleStatus || null,
      property_condition: propertyCondition || null,
      available_from: availableFrom || null,
      address_details: addressDetails || null,
      // Les coordonnées de l'hôte restent dans son profil, privé : la colonne
      // `listings` est lisible par tous (migration 202611190001).
      contact_name: user.name,
      host_id: user.id,
      status: "pending_review",
    })
    .select()
    .single();

  if (error || !listing) {
    throw new Error(error?.message || "Impossible de creer l'annonce.");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_host: true })
    .eq("id", user.id);

  if (profileError) throw new Error(profileError.message);

  const { error: photoError } = await supabase.from("listing_photos").insert(
    images.map((photo, index) => ({
      listing_id: listing.id,
      storage_path: photo,
      public_url: photo,
      alt_text: `${title} ${index + 1}`,
      position: index,
    }))
  );

  if (photoError) throw new Error(photoError.message);

  if (virtualTours.length) {
    const { error: tourError } = await supabase
      .from("listing_virtual_tours")
      .insert(virtualTours.map((tour, index) => ({
        listing_id: listing.id,
        provider: tour.provider,
        tour_url: tour.tourUrl,
        embed_url: tour.embedUrl,
        source_type: tour.sourceType,
        preview_image_url: tour.previewImageUrl ?? null,
        room_label: tour.roomLabel ?? null,
        position: tour.position ?? index,
        status: "active",
      })));

    if (tourError) throw new Error(tourError.message);
  }

  // Traduction FR / EN du titre et de la description. Jamais bloquante : en
  // cas d'échec, l'annonce s'affiche dans sa langue d'origine.
  const translations = await translateListingText({ title, description });
  if (translations) {
    await supabase.from("listings").update({ translations }).eq("id", listing.id);
  }

  // Toutes les langues (`/trips`, `/en/trips`…) : on invalide tout le site.
  revalidatePath("/", "layout");

  return mapListing({
    ...listing,
    listing_photos: images.map((photo, index) => ({
      storage_path: photo,
      public_url: photo,
      position: index,
    })),
    listing_virtual_tours: virtualTours.map((tour, index) => ({
      id: "",
      provider: tour.provider,
      tour_url: tour.tourUrl,
      embed_url: tour.embedUrl,
      source_type: tour.sourceType,
      preview_image_url: tour.previewImageUrl ?? null,
      room_label: tour.roomLabel ?? null,
      position: tour.position ?? index,
      status: "active",
    })),
    bookings: [],
    profiles: { full_name: user.name, avatar_url: user.image },
  });
};
