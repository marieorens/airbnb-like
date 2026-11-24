import { de, enUS, es, fr, it, pt } from "date-fns/locale";

/** Locale date-fns correspondant à la langue de l'interface. */
export const getDateLocale = (locale: string) =>
  ({ en: enUS, es, pt, de, it })[locale as "en" | "es" | "pt" | "de" | "it"] ?? fr;
