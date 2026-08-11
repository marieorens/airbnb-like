import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/types/listing";

export const getCurrentUser = async (): Promise<CurrentUser | undefined> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, role, is_host, phone, whatsapp, country_of_residence, city_of_residence, country_of_origin, account_purpose, preferred_contact, bio, profile_completed_at"
    )
    .eq("id", user.id)
    .single();

  const accountPurpose = profile?.account_purpose ?? [];
  const isProfileComplete = Boolean(
    profile?.profile_completed_at &&
      (profile?.full_name ?? user.user_metadata?.full_name) &&
      user.email &&
      profile?.phone &&
      profile?.country_of_residence &&
      profile?.city_of_residence &&
      profile?.country_of_origin &&
      accountPurpose.length > 0
  );

  return {
    id: user.id,
    email: user.email ?? null,
    name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
    image: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    role: profile?.role ?? "guest",
    isHost: profile?.is_host ?? false,
    phone: profile?.phone ?? null,
    whatsapp: profile?.whatsapp ?? null,
    countryOfResidence: profile?.country_of_residence ?? null,
    cityOfResidence: profile?.city_of_residence ?? null,
    countryOfOrigin: profile?.country_of_origin ?? null,
    accountPurpose,
    preferredContact: profile?.preferred_contact ?? "email",
    bio: profile?.bio ?? null,
    profileCompletedAt: profile?.profile_completed_at ?? null,
    isProfileComplete,
  };
};
