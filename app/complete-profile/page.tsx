import EmptyState from "@/components/EmptyState";
import { getCurrentUser } from "@/services/user";
import CompleteProfileForm from "./_components/CompleteProfileForm";

type CompleteProfilePageProps = {
  searchParams?: {
    next?: string;
  };
};

export default async function CompleteProfilePage({
  searchParams,
}: CompleteProfilePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <EmptyState
        title="Connexion requise"
        subtitle="Connectez-vous avant de compléter votre profil."
      />
    );
  }

  const next = searchParams?.next ?? "/";

  return (
    <section className="main-container max-w-5xl">
      <div className="grid gap-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:grid-cols-[0.85fr_1.15fr] md:p-8">
        <aside className="rounded-2xl bg-neutral-950 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-300">
            Profil VacationHub
          </p>
          <h1 className="mt-4 text-3xl font-black leading-tight">
            Complétez votre profil pour publier et contacter en confiance.
          </h1>
          <p className="mt-4 text-sm leading-6 text-neutral-300">
            La plateforme couvre les locations, ventes, parcelles et projets
            immobiliers. Ces informations aident notre équipe à modérer les annonces
            et les acheteurs comme les vendeurs à mieux se qualifier.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-neutral-200">
            <span className="rounded-lg bg-white/10 p-3">
              Google ou email : même parcours, profil complet obligatoire.
            </span>
            <span className="rounded-lg bg-white/10 p-3">
              Toute nouvelle annonce part en vérification admin.
            </span>
            <span className="rounded-lg bg-white/10 p-3">
              Vous pouvez être acheteur et vendeur avec le même compte.
            </span>
          </div>
        </aside>

        <CompleteProfileForm user={user} next={next} />
      </div>
    </section>
  );
}
