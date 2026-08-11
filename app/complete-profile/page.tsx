import EmptyState from "@/components/EmptyState";
import FormSubmitButton from "@/components/FormSubmitButton";
import { completeProfile } from "@/services/profile-actions";
import { getCurrentUser } from "@/services/user";

const accountPurposeOptions = [
  { value: "buyer", label: "Acheter un bien" },
  { value: "seller", label: "Vendre un bien" },
  { value: "renter", label: "Louer un bien" },
  { value: "host", label: "Proposer un logement court sejour" },
  { value: "investor", label: "Investir depuis la diaspora" },
  { value: "other", label: "Autre besoin immobilier" },
];

const inputClass =
  "h-12 w-full rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-900";

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
        subtitle="Connectez-vous avant de completer votre profil."
      />
    );
  }

  const next = searchParams?.next ?? "/";

  return (
    <section className="main-container max-w-5xl">
      <div className="grid gap-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:grid-cols-[0.85fr_1.15fr] md:p-8">
        <aside className="rounded-2xl bg-neutral-950 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-300">
            Profil Skybnb
          </p>
          <h1 className="mt-4 text-3xl font-black leading-tight">
            Completez votre profil pour publier et contacter en confiance.
          </h1>
          <p className="mt-4 text-sm leading-6 text-neutral-300">
            La plateforme couvre les locations, ventes, parcelles et projets
            immobiliers. Ces informations aident notre equipe a moderer les annonces
            et les acheteurs/vendeurs a mieux se qualifier.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-neutral-200">
            <span className="rounded-lg bg-white/10 p-3">
              Google ou email: meme parcours, profil complet obligatoire.
            </span>
            <span className="rounded-lg bg-white/10 p-3">
              Toute nouvelle annonce part en verification admin.
            </span>
            <span className="rounded-lg bg-white/10 p-3">
              Vous pouvez etre acheteur et vendeur avec le meme compte.
            </span>
          </div>
        </aside>

        <form action={completeProfile} className="space-y-6">
          <input type="hidden" name="next" value={next} />

          <div>
            <h2 className="text-2xl font-black text-neutral-950">
              Informations personnelles
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Les champs avec un astérisque sont obligatoires.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-bold text-neutral-700">
              Nom complet *
              <input
                name="fullName"
                required
                defaultValue={user.name ?? ""}
                className={inputClass}
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-neutral-700">
              Email
              <input
                name="email"
                type="email"
                disabled
                defaultValue={user.email ?? ""}
                className={`${inputClass} bg-neutral-100 text-neutral-500`}
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-neutral-700">
              Telephone *
              <input
                name="phone"
                required
                defaultValue={user.phone ?? ""}
                className={inputClass}
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-neutral-700">
              WhatsApp
              <input
                name="whatsapp"
                defaultValue={user.whatsapp ?? user.phone ?? ""}
                className={inputClass}
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-neutral-700">
              Pays de residence *
              <input
                name="countryOfResidence"
                required
                defaultValue={user.countryOfResidence ?? ""}
                className={inputClass}
                placeholder="France, Benin..."
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-neutral-700">
              Ville de residence *
              <input
                name="cityOfResidence"
                required
                defaultValue={user.cityOfResidence ?? ""}
                className={inputClass}
                placeholder="Paris, Cotonou..."
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-neutral-700">
              Pays origine / interet *
              <input
                name="countryOfOrigin"
                required
                defaultValue={user.countryOfOrigin ?? ""}
                className={inputClass}
                placeholder="Benin, Togo..."
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-neutral-700">
              Contact prefere
              <select
                name="preferredContact"
                defaultValue={user.preferredContact}
                className={inputClass}
              >
                <option value="email">Email</option>
                <option value="phone">Telephone</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-neutral-700">
              Je viens sur Skybnb pour *
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
              {accountPurposeOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 p-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400"
                >
                  <input
                    type="checkbox"
                    name="accountPurpose"
                    value={option.value}
                    defaultChecked={user.accountPurpose.includes(option.value)}
                    className="h-4 w-4 accent-rose-500"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-2 text-sm font-bold text-neutral-700">
            Presentation rapide
            <textarea
              name="bio"
              defaultValue={user.bio ?? ""}
              rows={4}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-900"
              placeholder="Ex: Beninois vivant en France, je cherche a investir au pays..."
            />
          </label>

          <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <FormSubmitButton pendingLabel="Mise a jour...">
              Enregistrer mon profil
            </FormSubmitButton>
          </div>
        </form>
      </div>
    </section>
  );
}
