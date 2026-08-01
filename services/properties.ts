"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getListings } from "./listing";
import { getCurrentUser } from "./user";

export const getProperties = async (args?: Record<string, string | undefined>) => {
  const user = await getCurrentUser();
  if (!user) {
    return {
      listings: [],
      nextCursor: null,
    };
  }

  return getListings({
    userId: args?.userId ?? user.id,
    cursor: args?.cursor,
  });
};

export const deleteProperty = async (listingId: string) => {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (!listingId || typeof listingId !== "string") {
    throw new Error("Invalid ID");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("host_id", currentUser.id);

  if (error) throw new Error("Failed to delete the property!");

  revalidatePath("/");
  revalidatePath("/reservations");
  revalidatePath("/trips");
  revalidatePath("/favorites");
  revalidatePath("/properties");
  revalidatePath(`/listings/${listingId}`);

  return "success";
};
