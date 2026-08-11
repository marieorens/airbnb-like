"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./user";

const requiredText = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function completeProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Connexion requise.");

  const fullName = requiredText(formData, "fullName");
  const phone = requiredText(formData, "phone");
  const whatsapp = requiredText(formData, "whatsapp");
  const countryOfResidence = requiredText(formData, "countryOfResidence");
  const cityOfResidence = requiredText(formData, "cityOfResidence");
  const countryOfOrigin = requiredText(formData, "countryOfOrigin");
  const preferredContact = requiredText(formData, "preferredContact") || "email";
  const bio = requiredText(formData, "bio");
  const next = requiredText(formData, "next") || "/";
  const accountPurpose = formData
    .getAll("accountPurpose")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (
    !fullName ||
    !phone ||
    !countryOfResidence ||
    !cityOfResidence ||
    !countryOfOrigin ||
    accountPurpose.length === 0
  ) {
    throw new Error("Merci de remplir les champs obligatoires du profil.");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      whatsapp: whatsapp || phone,
      country_of_residence: countryOfResidence,
      city_of_residence: cityOfResidence,
      country_of_origin: countryOfOrigin,
      account_purpose: accountPurpose,
      preferred_contact: preferredContact as "email" | "phone" | "whatsapp",
      bio: bio || null,
      profile_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/complete-profile");
  revalidatePath("/properties");

  redirect(next.startsWith("/") ? next : "/");
}
