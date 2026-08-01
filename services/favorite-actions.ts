"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./user";

export const updateFavorite = async ({
  listingId,
  favorite,
}: {
  listingId: string;
  favorite: boolean;
}) => {
  if (!listingId || typeof listingId !== "string") {
    throw new Error("Invalid ID");
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("Please sign in to favorite the listing!");
  }

  const supabase = createClient();

  if (favorite) {
    const { error } = await supabase.from("wishlists").upsert(
      {
        listing_id: listingId,
        user_id: currentUser.id,
      },
      { onConflict: "user_id,listing_id" }
    );

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("wishlists")
      .delete()
      .eq("listing_id", listingId)
      .eq("user_id", currentUser.id);

    if (error) throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/favorites");

  return {
    hasFavorited: favorite,
  };
};
