import { enUS, es, fr, pt } from "date-fns/locale";

/** Locale date-fns correspondant à la langue de l'interface. */
export const getDateLocale = (locale: string) =>
  ({ en: enUS, es, pt })[locale as "en" | "es" | "pt"] ?? fr;
