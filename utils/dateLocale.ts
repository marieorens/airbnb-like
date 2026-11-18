import { enUS, fr } from "date-fns/locale";

/** Locale date-fns correspondant à la langue de l'interface. */
export const getDateLocale = (locale: string) => (locale === "en" ? enUS : fr);
