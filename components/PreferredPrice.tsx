"use client";

import { usePrice } from "@/components/CurrencyProvider";

/**
 * Prix dans la devise préférée (« ≈ XOF 65,600 »), ou d'origine sans
 * préférence. Composant client : utilisable depuis une carte rendue côté serveur.
 */
const PreferredPrice = ({ amount, currency }: { amount: number; currency: string }) => {
  const { main } = usePrice(amount, currency);
  return <>{main}</>;
};

export default PreferredPrice;
