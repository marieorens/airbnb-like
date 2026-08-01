export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/auth\/v1\/?$/, "").replace(/\/$/, "");
}

export function getSupabasePublicKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return key;
}

export function getSupabasePublicKeySource() {
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
  }

  return null;
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return key;
}
