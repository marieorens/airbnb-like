import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { translateListingText } from "@/lib/listing-translation";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/types/supabase";

/**
 * Traduction FR / EN d'une annonce, appelée par le mobile juste après la
 * publication (le web traduit directement dans `createListing`).
 *
 * La clé DeepL ne peut pas vivre dans l'application : la traduction passe
 * donc par ici. L'identité vient du jeton Supabase, jamais du corps, et toutes
 * les lectures / écritures se font avec ce jeton : la politique RLS
 * « Hosts update own listings » garantit qu'on ne traduit que ses propres annonces.
 */

const log = (...parts: unknown[]) => console.log("[translate-listing]", ...parts);

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ message: "Authentification requise." }, { status: 401 });
  }

  const supabase = createClient<Database>(getSupabaseUrl(), getSupabasePublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ message: "Session invalide." }, { status: 401 });
  }

  let listingId: unknown;
  try {
    ({ listingId } = (await request.json()) as { listingId?: unknown });
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  if (typeof listingId !== "string") {
    return NextResponse.json({ message: "Identifiant d'annonce manquant." }, { status: 400 });
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, host_id, title, description")
    .eq("id", listingId)
    .single();

  if (!listing || listing.host_id !== user.id) {
    return NextResponse.json({ message: "Annonce introuvable." }, { status: 404 });
  }

  const translations = await translateListingText({
    title: listing.title,
    description: listing.description,
  });

  if (!translations) {
    log("ignorée pour", listing.id, "(clé absente ou échec)");
    return NextResponse.json({ ok: true, translated: false });
  }

  const { error } = await supabase
    .from("listings")
    .update({ translations })
    .eq("id", listing.id);

  if (error) {
    log("échec de l'enregistrement pour", listing.id, ":", error.message);
    return NextResponse.json({ ok: false, translated: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, translated: true });
}
