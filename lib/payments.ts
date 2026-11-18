export type PaymentProvider = "stripe" | "kkiapay";

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return value === "stripe" || value === "kkiapay";
}

export function paymentProviderLabel(provider: string): string {
  if (provider === "kkiapay") return "Kkiapay";
  if (provider === "stripe") return "Stripe";
  return provider;
}
