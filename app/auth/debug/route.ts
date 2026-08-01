import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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
    supabaseCookieNames: cookieNames,
  });
}
