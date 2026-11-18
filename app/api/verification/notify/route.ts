import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { localizePath } from "@/i18n/routing";
import {
  isMailerConfigured,
  sendEmail,
  verificationDecisionEmail,
  verificationReasonLabels,
  type VerificationReason,
} from "@/lib/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

/**
 * Email de décision sur un dossier de vérification, déclenché par le
 * back-office après une validation ou un refus.
 *
 * Le back-office n'a pas d'accès SMTP : il envoie le JWT de l'administrateur,
 * comme pour les remboursements. On vérifie son rôle, puis on relit la décision
 * en base : le contenu de l'email ne vient jamais du corps de la requête.
 */

const log = (...parts: unknown[]) => console.log("[verification-notify]", ...parts);

const isReason = (value: string): value is VerificationReason =>
  value in verificationReasonLabels;

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!token) {
    return NextResponse.json({ message: "Authentification requise." }, { status: 401 });
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ message: "Session invalide." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  let userId: unknown;
  try {
    ({ userId } = (await request.json()) as { userId?: unknown });
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ message: "Membre invalide." }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, verification_status, verification_reasons, verification_note")
    .eq("id", userId)
    .single();

  if (!profile?.email) {
    return NextResponse.json({ message: "Membre introuvable." }, { status: 404 });
  }
  if (profile.verification_status !== "approved" && profile.verification_status !== "rejected") {
    return NextResponse.json({ message: "Aucune décision à notifier." }, { status: 409 });
  }

  if (!isMailerConfigured()) {
    log("ignoré : GMAIL_USER ou GMAIL_APP_PASSWORD absent");
    return NextResponse.json({ ok: false, skipped: "mailer-not-configured" });
  }

  const approved = profile.verification_status === "approved";
  const origin = (process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(/\/+$/, "");
  const path = approved ? "/" : "/verification";

  const email = verificationDecisionEmail({
    name: profile.full_name,
    approved,
    reasons: (profile.verification_reasons ?? []).filter(isReason),
    note: profile.verification_note,
    urls: {
      fr: `${origin}${localizePath(path, "fr")}`,
      en: `${origin}${localizePath(path, "en")}`,
    },
  });

  try {
    await sendEmail({ to: profile.email, refId: `verification-${userId}-${Date.now()}`, ...email });
  } catch (error) {
    log("échec :", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, skipped: "send-failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
