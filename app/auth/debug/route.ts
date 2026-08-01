import { NextResponse, type NextRequest } from "next/server";

import {
  getSupabasePublicKey,
  getSupabasePublicKeySource,
  getSupabaseUrl,
} from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabaseUrl = getSupabaseUrl();
  const publicKey = getSupabasePublicKey();
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const cookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-"));

  return NextResponse.json({
    hasUser: Boolean(user),
    userId: user?.id ?? null,
    email: user?.email ?? null,
    error: error?.message ?? null,
    supabaseUrlHost: new URL(supabaseUrl).host,
    publicKeySource: getSupabasePublicKeySource(),
    publicKeyPrefix: publicKey.slice(0, 18),
    publicKeyLength: publicKey.length,
    supabaseCookieNames: cookieNames,
  });
}
