import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

/**
 * Habillage commun de la page de paiement Kkiapay.
 *
 * Le mode sombre du site passe par les surcharges globales de `globals.css`
 * (`html[data-theme="dark"] .bg-white`, etc.) : on reste donc sur les classes
 * neutral déjà prises en charge.
 */
export function PaymentShell({ children }: { children: ReactNode }) {
  const t = useTranslations("payment");
  return (
    <main className="min-h-screen bg-[#F7F7F4] px-4 py-10 text-neutral-900">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href="/"
          className="inline-block text-lg font-black tracking-tight text-neutral-950"
        >
          VacationHub
        </Link>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          {children}
        </div>

        <p className="mt-4 text-center text-xs font-medium leading-5 text-neutral-500">
          {t("secured")}
        </p>
      </div>
    </main>
  );
}
