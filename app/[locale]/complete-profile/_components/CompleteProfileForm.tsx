"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { useTranslations } from "next-intl";

import FormSubmitButton from "@/components/FormSubmitButton";
import { completeProfile } from "@/services/profile-actions";
import type { CurrentUser } from "@/types/listing";
import { isValidPhone } from "@/utils/phone";
import { EMPTY_PROFILE_STATE, type ProfileField } from "@/types/profileForm";

// Libellés : `auth.purposes.<valeur>` ; messages d'erreur : `profile.errors.<champ>`.
const accountPurposeOptions = [
  "buyer",
  "seller",
  "renter",
  "host",
  "investor",
  "other",
] as const;

/** Tous les champs texte sont obligatoires. */
const REQUIRED_TEXT_FIELDS = [
  "fullName",
  "phone",
  "countryOfResidence",
  "cityOfResidence",
  "countryOfOrigin",
  "bio",
] as const satisfies readonly ProfileField[];

type FieldErrors = Partial<Record<ProfileField, string>>;

function validate(
  formData: FormData,
  message: (field: ProfileField) => string,
  phoneInvalid: string
): FieldErrors {
  const errors: FieldErrors = {};

  REQUIRED_TEXT_FIELDS.forEach((name) => {
    if (!String(formData.get(name) ?? "").trim()) errors[name] = message(name);
  });

  const phone = String(formData.get("phone") ?? "").trim();
  if (phone && !isValidPhone(phone)) errors.phone = phoneInvalid;

  if (formData.getAll("accountPurpose").length === 0) {
    errors.accountPurpose = message("accountPurpose");
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
  const t = useTranslations("profile");
  const tPurpose = useTranslations("auth.purposes");
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
    const found = validate(
      new FormData(form),
      (field) => t(`errors.${field}`),
      t("errors.phoneInvalid")
    );
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
        <h2 className="text-2xl font-black text-neutral-950">{t("formTitle")}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {t("allRequired")}
        </p>
      </div>

      {hasErrors || state.message ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"
        >
          {state.message ?? t("errors.missingFields")}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            name: "fullName" as const,
            label: t("fields.fullName"),
            defaultValue: values?.fullName ?? user.name ?? "",
            placeholder: undefined,
          },
          {
            name: "phone" as const,
            label: t("fields.phone"),
            defaultValue: values?.phone ?? user.phone ?? "",
            placeholder: undefined,
          },
          {
            name: "countryOfResidence" as const,
            label: t("fields.countryOfResidence"),
            defaultValue: values?.countryOfResidence ?? user.countryOfResidence ?? "",
            placeholder: t("placeholders.countryOfResidence"),
          },
          {
            name: "cityOfResidence" as const,
            label: t("fields.cityOfResidence"),
            defaultValue: values?.cityOfResidence ?? user.cityOfResidence ?? "",
            placeholder: t("placeholders.cityOfResidence"),
          },
          {
            name: "countryOfOrigin" as const,
            label: t("fields.countryOfOrigin"),
            defaultValue: values?.countryOfOrigin ?? user.countryOfOrigin ?? "",
            placeholder: t("placeholders.countryOfOrigin"),
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
          {t("fields.email")}
          <input
            name="email"
            type="email"
            disabled
            defaultValue={user.email ?? ""}
            className={`${baseInput} h-12 border-neutral-300 bg-neutral-100 text-neutral-500`}
          />
          <p className="text-xs font-medium text-neutral-500">
            {t("emailLocked")}
          </p>
        </label>

        <label className="space-y-2 text-sm font-bold text-neutral-700">
          {t("fields.preferredContact")}
          <select
            name="preferredContact"
            defaultValue={
              values?.preferredContact ??
              (user.preferredContact === "whatsapp" ? "email" : user.preferredContact)
            }
            className={inputClass(false)}
          >
            <option value="email">{t("contact.email")}</option>
            <option value="phone">{t("contact.phone")}</option>
          </select>
        </label>
      </div>

      <fieldset
        className={`space-y-3 rounded-lg p-3 ${
          errors.accountPurpose ? "border-2 border-rose-500 bg-rose-50" : ""
        }`}
      >
        <legend className="text-sm font-bold text-neutral-700">
          {t("fields.accountPurpose")}
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          {accountPurposeOptions.map((purpose) => (
            <label
              key={purpose}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400"
            >
              <input
                type="checkbox"
                name="accountPurpose"
                value={purpose}
                defaultChecked={selectedPurposes.includes(purpose)}
                onChange={() => clearError("accountPurpose")}
                className="h-4 w-4 accent-rose-500"
              />
              {tPurpose(purpose)}
            </label>
          ))}
        </div>
        <FieldError message={errors.accountPurpose} />
      </fieldset>

      <label className="block space-y-2 text-sm font-bold text-neutral-700">
        {t("fields.bio")}
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
          placeholder={t("placeholders.bio")}
        />
        <FieldError message={errors.bio} />
      </label>

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <FormSubmitButton pendingLabel={t("saving")}>
          {t("save")}
        </FormSubmitButton>
      </div>
    </form>
  );
}
