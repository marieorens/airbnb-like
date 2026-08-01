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
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
    image: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
  };
};
