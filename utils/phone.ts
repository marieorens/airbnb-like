/**
 * Numéro de téléphone plausible : 8 à 15 chiffres, `+` facultatif au début,
 * espaces, points, tirets et parenthèses tolérés. Même règle que le mobile
 * (`airbnb-clone-mobile/src/lib/phone.ts`).
 *
 * Un contrôle de forme, pas une vérification d'existence : il écarte les
 * saisies manifestement fausses (un prénom dans le champ téléphone).
 */
export function isValidPhone(value: string): boolean {
  const compact = value.trim().replace(/[\s.\-()]/g, "");
  return /^\+?\d{8,15}$/.test(compact);
}
