import { getTranslations } from "next-intl/server";

import EmptyState from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/services/user";
import VerificationClient, { type VerificationDocument } from "./_components/VerificationClient";

/**
 * Vérification du compte : type de compte, envoi des documents d'identité et
 * suivi de la décision de la modération. Publier un bien exige un compte validé.
 *
 * Le middleware n'ouvre cette page qu'à un utilisateur connecté au profil complet.
 */
export default async function VerificationPage() {
  const t = await getTranslations("verification");
  const user = await getCurrentUser();

  if (!user) {
    return <EmptyState title={t("signInRequired")} subtitle={t("signInPrompt")} />;
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("verification_documents")
    .select("kind, storage_path")
    .eq("user_id", user.id);

  const documents: VerificationDocument[] = (data ?? []).map((row) => ({
    kind: row.kind,
    storagePath: row.storage_path,
  }));

  return (
    <section className="main-container max-w-4xl">
      <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E11D48]">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-neutral-500">{t("intro")}</p>

        <VerificationClient
          userId={user.id}
          accountType={user.accountType}
          companyName={user.companyName}
          status={user.verificationStatus}
          note={user.verificationNote}
          reasons={user.verificationReasons}
          documents={documents}
        />
      </div>
    </section>
  );
}
