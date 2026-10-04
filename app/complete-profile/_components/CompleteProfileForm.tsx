"use client";

import { useState } from "react";
import { useFormState } from "react-dom";

import FormSubmitButton from "@/components/FormSubmitButton";
import { completeProfile } from "@/services/profile-actions";
import type { CurrentUser } from "@/types/listing";
import { EMPTY_PROFILE_STATE, type ProfileField } from "@/types/profileForm";

const accountPurposeOptions = [
  { value: "buyer", label: "Acheter un bien" },
  { value: "seller", label: "Vendre un bien" },
  { value: "renter", label: "Louer un bien" },
  { value: "host", label: "Proposer un logement court séjour" },
  { value: "investor", label: "Investir depuis la diaspora" },
  { value: "other", label: "Autre besoin immobilier" },
];

/** Tous les champs texte sont obligatoires. */
const REQUIRED_TEXT_FIELDS: { name: ProfileField; message: string }[] = [
  { name: "fullName", message: "Le nom complet est obligatoire." },
  { name: "phone", message: "Le téléphone est obligatoire." },
  { name: "countryOfResidence", message: "Le pays de résidence est obligatoire." },
  { name: "cityOfResidence", message: "La ville de résidence est obligatoire." },
  { name: "countryOfOrigin", message: "Le pays d'origine est obligatoire." },
  { name: "bio", message: "La présentation est obligatoire." },
];

type FieldErrors = Partial<Record<ProfileField, string>>;

function validate(formData: FormData): FieldErrors {
  const errors: FieldErrors = {};

  REQUIRED_TEXT_FIELDS.forEach(({ name, message }) => {
    if (!String(formData.get(name) ?? "").trim()) errors[name] = message;
  });

  if (formData.getAll("accountPurpose").length === 0) {
    errors.accountPurpose = "Choisissez au moins un objectif.";
  }

  return errors;
}

const baseInput =
  "w-full rounded-lg border bg-white px-4 text-sm font-medium text-neutral-900 outline-none transition";

const inputClass = (hasError: boolean) =>
  `${baseInput} h-12 ${
    hasError
      ? "border-2 border-rose-500 bg-rose-50 focus:border-rose-600"
      : "border-neutral-300 focus:border-neutral-900"
  }`;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-bold text-rose-600">{message}</p>;
}

type CompleteProfileFormProps = {
  user: CurrentUser;
  next: string;
};

export default function CompleteProfileForm({ user, next }: CompleteProfileFormProps) {
  const [state, formAction] = useFormState(completeProfile, EMPTY_PROFILE_STATE);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  // Les erreurs du navigateur priment : elles sont plus fraiches que celles
  // renvoyees par le serveur lors d'une soumission precedente.
  const errors: FieldErrors = { ...state.errors, ...clientErrors };
  const values = state.values;
  const selectedPurposes = values?.accountPurpose ?? user.accountPurpose;

  const hasErrors = Object.keys(errors).length > 0;

  /**
   * Bloque la soumission tant que le formulaire est incomplet.
   *
   * `preventDefault` empeche React de declencher la Server Action : rien ne
   * part au serveur, et le premier champ fautif recoit le focus.
   */
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const found = validate(new FormData(form));
    setClientErrors(found);

    const firstInvalid = Object.keys(found)[0];
    if (!firstInvalid) return;

    event.preventDefault();
    const element = form.elements.namedItem(firstInvalid);
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus({ preventScroll: true });
    }
  };

  const clearError = (name: ProfileField) =>
    setClientErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-6">
      <input type="hidden" name="next" value={next} />

      <div>
        <h2 className="text-2xl font-black text-neutral-950">Informations personnelles</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Tous les champs sont obligatoires.
        </p>
      </div>

      {hasErrors || state.message ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"
        >
          {state.message ?? "Certains champs obligatoires sont manquants."}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            name: "fullName" as const,
            label: "Nom complet *",
            defaultValue: values?.fullName ?? user.name ?? "",
            placeholder: undefined,
          },
          {
            name: "phone" as const,
            label: "Téléphone *",
            defaultValue: values?.phone ?? user.phone ?? "",
            placeholder: undefined,
          },
          {
            name: "countryOfResidence" as const,
            label: "Pays de résidence *",
            defaultValue: values?.countryOfResidence ?? user.countryOfResidence ?? "",
            placeholder: "France, Bénin...",
          },
          {
            name: "cityOfResidence" as const,
            label: "Ville de résidence *",
            defaultValue: values?.cityOfResidence ?? user.cityOfResidence ?? "",
            placeholder: "Paris, Cotonou...",
          },
          {
            name: "countryOfOrigin" as const,
            label: "Pays d'origine ou d'intérêt *",
            defaultValue: values?.countryOfOrigin ?? user.countryOfOrigin ?? "",
            placeholder: "Bénin, Togo...",
          },
        ].map((field) => (
          <label key={field.name} className="space-y-2 text-sm font-bold text-neutral-700">
            {field.label}
            <input
              name={field.name}
              defaultValue={field.defaultValue}
              placeholder={field.placeholder}
              aria-invalid={Boolean(errors[field.name])}
              onChange={() => clearError(field.name)}
              className={inputClass(Boolean(errors[field.name]))}
            />
            <FieldError message={errors[field.name]} />
          </label>
        ))}

        <label className="space-y-2 text-sm font-bold text-neutral-700">
          Email
          <input
            name="email"
            type="email"
            disabled
            defaultValue={user.email ?? ""}
            className={`${baseInput} h-12 border-neutral-300 bg-neutral-100 text-neutral-500`}
          />
          <p className="text-xs font-medium text-neutral-500">
            Non modifiable : c&apos;est votre identifiant de connexion.
          </p>
        </label>

        <label className="space-y-2 text-sm font-bold text-neutral-700">
          Contact préféré *
          <select
            name="preferredContact"
            defaultValue={
              values?.preferredContact ??
              (user.preferredContact === "whatsapp" ? "email" : user.preferredContact)
            }
            className={inputClass(false)}
          >
            <option value="email">Email</option>
            <option value="phone">Téléphone</option>
          </select>
        </label>
      </div>

      <fieldset
        className={`space-y-3 rounded-lg p-3 ${
          errors.accountPurpose ? "border-2 border-rose-500 bg-rose-50" : ""
        }`}
      >
        <legend className="text-sm font-bold text-neutral-700">
          Je viens sur VacationHub pour *
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          {accountPurposeOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400"
            >
              <input
                type="checkbox"
                name="accountPurpose"
                value={option.value}
                defaultChecked={selectedPurposes.includes(option.value)}
                onChange={() => clearError("accountPurpose")}
                className="h-4 w-4 accent-rose-500"
              />
              {option.label}
            </label>
          ))}
        </div>
        <FieldError message={errors.accountPurpose} />
      </fieldset>

      <label className="block space-y-2 text-sm font-bold text-neutral-700">
        Présentation rapide *
        <textarea
          name="bio"
          defaultValue={values?.bio ?? user.bio ?? ""}
          rows={4}
          aria-invalid={Boolean(errors.bio)}
          onChange={() => clearError("bio")}
          className={`${baseInput} py-3 ${
            errors.bio
              ? "border-2 border-rose-500 bg-rose-50 focus:border-rose-600"
              : "border-neutral-300 focus:border-neutral-900"
          }`}
          placeholder="Ex : Béninois vivant en France, je cherche à investir au pays..."
        />
        <FieldError message={errors.bio} />
      </label>

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <FormSubmitButton pendingLabel="Mise à jour...">
          Enregistrer mon profil
        </FormSubmitButton>
      </div>
    </form>
  );
}
