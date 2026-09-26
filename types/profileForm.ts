export const PROFILE_FIELDS = [
  "fullName",
  "phone",
  "whatsapp",
  "countryOfResidence",
  "cityOfResidence",
  "countryOfOrigin",
  "preferredContact",
  "bio",
  "accountPurpose",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

/**
 * Etat renvoye par l'action de completion de profil.
 *
 * L'action ne leve plus d'exception quand un champ manque : elle renvoie les
 * erreurs, que le formulaire affiche. Une exception non rattrapee dans une
 * Server Action produit une page « Application error » sans aucune indication.
 */
export type CompleteProfileState = {
  /** Message d'erreur par champ. */
  errors?: Partial<Record<ProfileField, string>>;
  /** Message global, par exemple en cas d'echec cote base. */
  message?: string;
  /** Valeurs saisies, renvoyees pour ne pas vider le formulaire. */
  values?: {
    fullName: string;
    phone: string;
    whatsapp: string;
    countryOfResidence: string;
    cityOfResidence: string;
    countryOfOrigin: string;
    preferredContact: string;
    bio: string;
    accountPurpose: string[];
  };
};

export const EMPTY_PROFILE_STATE: CompleteProfileState = {};
