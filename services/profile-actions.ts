"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./user";
import type { CompleteProfileState, ProfileField } from "@/types/profileForm";

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

/**
 * Tous les champs du formulaire sont obligatoires.
 *
 * C'est plus strict que `profile_is_complete()` en base, qui n'exige pas la
 * presentation. Ce choix vient du produit : un profil complet doit etre
 * reellement exploitable par les acheteurs et la moderation.
 */
const REQUIRED_FIELDS: { field: ProfileField; message: string }[] = [
  { field: "fullName", message: "Le nom complet est obligatoire." },
  { field: "phone", message: "Le téléphone est obligatoire." },
  { field: "countryOfResidence", message: "Le pays de résidence est obligatoire." },
  { field: "cityOfResidence", message: "La ville de résidence est obligatoire." },
  { field: "countryOfOrigin", message: "Le pays d'origine est obligatoire." },
  { field: "bio", message: "La présentation est obligatoire." },
];

/**
 * Completion du profil.
 *
 * Signature `useFormState` : l'action renvoie un etat plutot que de lever une
 * exception. Sans cela, un champ manquant produit une page « Application
 * error » generique, sans indiquer ce qui cloche.
 */
export async function completeProfile(
  _prevState: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const user = await getCurrentUser();
  if (!user) {
    return { message: "Connexion requise." };
  }

  const values = {
    fullName: text(formData, "fullName"),
    phone: text(formData, "phone"),
    countryOfResidence: text(formData, "countryOfResidence"),
    cityOfResidence: text(formData, "cityOfResidence"),
    countryOfOrigin: text(formData, "countryOfOrigin"),
    preferredContact: text(formData, "preferredContact") || "email",
    bio: text(formData, "bio"),
    accountPurpose: formData
      .getAll("accountPurpose")
      .map((value) => String(value).trim())
      .filter(Boolean),
  };

  const errors: Partial<Record<ProfileField, string>> = {};

  REQUIRED_FIELDS.forEach(({ field, message }) => {
    if (!values[field as keyof typeof values]) {
      errors[field] = message;
    }
  });

  if (values.accountPurpose.length === 0) {
    errors.accountPurpose = "Choisissez au moins un objectif.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      message: "Certains champs obligatoires sont manquants.",
      values,
    };
  }

  const next = text(formData, "next") || "/";

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: values.fullName,
      phone: values.phone,
      country_of_residence: values.countryOfResidence,
      city_of_residence: values.cityOfResidence,
      country_of_origin: values.countryOfOrigin,
      account_purpose: values.accountPurpose,
      preferred_contact: values.preferredContact as "email" | "phone",
      bio: values.bio || null,
      profile_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return {
      message: "Enregistrement impossible. Réessayez dans un instant.",
      values,
    };
  }

  revalidatePath("/");
  revalidatePath("/complete-profile");
  revalidatePath("/properties");

  // `redirect` leve volontairement : il doit rester hors de tout try/catch.
  redirect(next.startsWith("/") ? next : "/");
}
