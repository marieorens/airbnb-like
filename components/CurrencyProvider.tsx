"use client";

import { createContext, useContext, type PropsWithChildren } from "react";

import { displayPrice, type Currency, type Rates } from "@/lib/currency";

type CurrencyContextValue = {
  /** Devise choisie ; `null` = devise de chaque annonce. */
  preferred: Currency | null;
  /** Taux du jour ; `null` si l'API ne répond pas (prix laissés d'origine). */
  rates: Rates | null;
};

const CurrencyContext = createContext<CurrencyContextValue>({ preferred: null, rates: null });

/**
 * Devise préférée et taux du jour, lus une fois côté serveur par le layout
 * puis partagés avec tous les composants qui affichent un prix.
 */
export function CurrencyProvider({
  preferred,
  rates,
  children,
}: PropsWithChildren<CurrencyContextValue>) {
  return (
    <CurrencyContext.Provider value={{ preferred, rates }}>{children}</CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);

/** Prix prêt à afficher dans la devise préférée (voir `displayPrice`). */
export function usePrice(amount: number, currency: string) {
  const { preferred, rates } = useCurrency();
  return displayPrice(amount, currency, preferred, rates);
}
