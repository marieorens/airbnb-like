import { createClient } from "@/lib/supabase/server";
import { getListingsByIds } from "./listing";
import { getCurrentUser } from "./user";

export const getFavorites = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("wishlists")
      .select("listing_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((item) => item.listing_id);
  } catch {
    return [];
  }
};

export const getFavoriteListings = async () => {
  const favoriteIds = await getFavorites();
  return getListingsByIds(favoriteIds);
};
