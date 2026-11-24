import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { translateListingText, translateListingTo } from "@/lib/listing-translation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOnDemandLocale, parseTranslations, type OnDemandLocale } from "@/utils/listingText";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database, Json } from "@/types/supabase";

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

/**
 * Traduction à la demande d'une annonce publiée dans une langue supplémentaire
 * (espagnol, portugais…), au premier affichage de sa fiche dans cette langue.
 *
 * Ouverte aux visiteurs : elle ne touche qu'une annonce publiée, n'écrit que la
 * langue demandée, et ne traduit qu'une fois (déjà présente → renvoyée telle
 * quelle). Le coût DeepL est donc borné par le nombre d'annonces × langues.
 */
async function translateOnDemand(listingId: string, locale: OnDemandLocale) {
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, title, description, translations, status")
    .eq("id", listingId)
    .single();

  if (!listing || listing.status !== "published") {
    return NextResponse.json({ message: "Annonce introuvable." }, { status: 404 });
  }

  const existing = parseTranslations(listing.translations);
  const already = existing?.[locale];
  if (already) return NextResponse.json({ ok: true, translated: true, ...already });

  const version = await translateListingTo(
    { title: listing.title, description: listing.description },
    locale
  );
  if (!version) {
    log("à la demande ignorée pour", listing.id, locale, "(clé absente, quota ou échec)");
    return NextResponse.json({ ok: true, translated: false });
  }

  // Relecture juste avant l'écriture : on n'écrase pas une autre langue ajoutée entre-temps.
  const { data: fresh } = await admin
    .from("listings")
    .select("translations")
    .eq("id", listing.id)
    .single();
  const current =
    fresh?.translations && typeof fresh.translations === "object" ? fresh.translations : {};
  const { error } = await admin
    .from("listings")
    .update({ translations: { ...(current as Record<string, Json>), [locale]: version } })
    .eq("id", listing.id);
  if (error) log("échec de l'enregistrement", listing.id, locale, ":", error.message);

  return NextResponse.json({ ok: true, translated: true, ...version });
}

export async function POST(request: Request) {
  let body: { listingId?: unknown; locale?: unknown };
  try {
    body = (await request.json()) as { listingId?: unknown; locale?: unknown };
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  // Langue supplémentaire demandée par un visiteur : pas d'authentification.
  if (isOnDemandLocale(body.locale)) {
    if (typeof body.listingId !== "string") {
      return NextResponse.json({ message: "Identifiant d'annonce manquant." }, { status: 400 });
    }
    return translateOnDemand(body.listingId, body.locale);
  }

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

  const { listingId } = body;

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
