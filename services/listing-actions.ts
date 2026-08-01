"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./user";
import { mapListing } from "./listing";

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

  if (error || !listing) {
    throw new Error(error?.message || "Failed to create listing");
  }

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
