"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./user";

export const deleteProperty = async (listingId: string) => {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Connexion requise.");
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

  // Toutes les langues (`/trips`, `/en/trips`…) : on invalide tout le site.
  revalidatePath("/", "layout");

  return "success";
};
