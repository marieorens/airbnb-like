import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

/**
 * Profil public d'un autre membre : nom, avatar, type de compte, badge vérifié.
 *
 * La table `profiles` n'est lisible que par son propriétaire (migration
 * 202611190001). Pour afficher un hôte ou un interlocuteur, on passe par la vue
 * `public_profiles`, qui ne contient ni email, ni téléphone.
 */
export type PublicProfile = Database["public"]["Views"]["public_profiles"]["Row"];

/** Profils publics des identifiants donnés, indexés par identifiant. */
export async function fetchPublicProfiles(
  supabase: SupabaseClient<Database>,
  ids: (string | null | undefined)[]
): Promise<Map<string, PublicProfile>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (!unique.length) return new Map();

  const { data } = await supabase
    .from("public_profiles")
    .select("id, full_name, avatar_url, account_type, company_name, is_verified")
    .in("id", unique);

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}
