"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { CURRENCY_COOKIE, isCurrency, type Currency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";

/**
 * Devise préférée (décision validée : profil + appareil).
 * Connecté et choisie dans le profil : elle fait foi. Sinon, le cookie du
 * navigateur. `null` = chaque prix dans la devise de son annonce.
 */
export async function getPreferredCurrency(): Promise<Currency | null> {
  const cookieValue = cookies().get(CURRENCY_COOKIE)?.value;
  const local = isCurrency(cookieValue) ? cookieValue : null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return local;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", user.id)
    .single();
  return profile?.preferred_currency ?? local;
}

/** Change la devise préférée : cookie du navigateur, et profil si connecté. */
export async function setPreferredCurrency(value: string | null): Promise<void> {
  const currency = isCurrency(value) ? value : null;

  if (currency) {
    cookies().set(CURRENCY_COOKIE, currency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    cookies().delete(CURRENCY_COOKIE);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ preferred_currency: currency }).eq("id", user.id);
  }

  // Tous les prix de toutes les pages, dans les deux langues.
  revalidatePath("/", "layout");
}
