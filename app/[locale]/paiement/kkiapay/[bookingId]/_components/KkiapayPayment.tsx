"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import SpinnerMini from "@/components/Loader";
import {
  cancelPendingCheckout,
  verifyKkiapayPayment,
} from "@/services/reservation-actions";
import { formatPrice } from "@/utils/helper";

type KkiapayPaymentProps = {
  bookingId: string;
  amount: number;
  publicKey: string;
  sandbox: boolean;
  /** Sandbox sans cles serveur : la confirmation repose sur le retour du widget. */
  sandboxUnverified: boolean;
  successUrl: string;
  cancelUrl: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  nightCount: number;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
};

type KkiapaySuccessPayload = {
  transactionId?: string;
};

type PaymentState =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "error"; message: string }
  | { kind: "pending"; message: string };

declare global {
  interface Window {
    openKkiapayWidget?: (options: Record<string, unknown>) => void;
    addKkiapayListener?: (
      event: string,
      handler: (payload: unknown) => void
    ) => void;
    removeKkiapayListener?: (
      event: string,
      handler: (payload: unknown) => void
    ) => void;
  }
}

const formatDate = (value: string, locale: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Ajoute un statut à une URL de retour, y compris un deep link mobile. */
function withStatus(url: string, status: string): string {
  try {
    const next = new URL(url);
    next.searchParams.set("status", status);
    return next.toString();
  } catch {
    return url;
  }
}

export function KkiapayPayment({
  bookingId,
  amount,
  publicKey,
  sandbox,
  sandboxUnverified,
  successUrl,
  cancelUrl,
  listingTitle,
  checkIn,
  checkOut,
  nightCount,
  customer,
}: KkiapayPaymentProps) {
  const t = useTranslations("payment");
  const locale = useLocale();
  const [scriptReady, setScriptReady] = useState(false);
  const [state, setState] = useState<PaymentState>({ kind: "idle" });

  useEffect(() => {
    if (!scriptReady) return;

    let active = true;

    const handler = async (payload: unknown) => {
      const transactionId =
        typeof payload === "string"
          ? payload
          : (payload as KkiapaySuccessPayload | null)?.transactionId;

      if (!transactionId) {
        if (active) {
          setState({
            kind: "error",
            message: t("noTransactionId"),
          });
        }
        return;
      }

      setState({ kind: "verifying" });

      try {
        const result = await verifyKkiapayPayment({ bookingId, transactionId });
        if (!active) return;

        if (result.status === "confirmed") {
          window.location.assign(successUrl);
          return;
        }

        setState({ kind: "pending", message: result.message });
      } catch (error) {
        if (!active) return;
        setState({
          kind: "error",
          message:
            error instanceof Error && error.message ? error.message : t("verifyFailed"),
        });
      }
    };

    window.addKkiapayListener?.("success", handler);

    return () => {
      active = false;
      window.removeKkiapayListener?.("success", handler);
    };
  }, [bookingId, scriptReady, successUrl, t]);

  const openWidget = () => {
    if (!window.openKkiapayWidget) {
      setState({
        kind: "error",
        message: t("notLoaded"),
      });
      return;
    }

    const phone = customer.phone?.replace(/\D/g, "");

    window.openKkiapayWidget({
      amount,
      key: publicKey,
      sandbox,
      partnerId: bookingId,
      data: bookingId,
      name: customer.name ?? undefined,
      email: customer.email ?? undefined,
      phone: phone || undefined,
      position: "center",
      theme: "#E11D48",
    });
  };

  const onCancel = async () => {
    try {
      await cancelPendingCheckout(bookingId);
    } catch {
      // L'annulation est un confort : on ne bloque jamais le retour.
    }
    window.location.assign(withStatus(cancelUrl, "cancelled"));
  };

  return (
    <div>
      <Script
        src="https://cdn.kkiapay.me/k.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() =>
          setState({
            kind: "error",
            message: t("loadFailed"),
          })
        }
      />

      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-500">
        {t("kicker")}
      </p>
      <h1 className="mt-2 text-xl font-black leading-tight text-neutral-950">
        {listingTitle}
      </h1>
      <p className="mt-1 text-sm font-medium text-neutral-600">
        {formatDate(checkIn, locale)} → {formatDate(checkOut, locale)} ·{" "}
        {t("nights", { count: nightCount })}
      </p>

      <div className="mt-5 flex items-baseline justify-between border-t border-neutral-200 pt-4">
        <span className="text-sm font-semibold text-neutral-600">
          {t("totalDue")}
        </span>
        <span className="text-2xl font-black text-neutral-950">
          {formatPrice(amount)} XOF
        </span>
      </div>



      {state.kind === "error" ? (
        <div className="mt-5 rounded-xl border border-rose-500/40 bg-neutral-100 p-4">
          <p className="text-sm font-semibold leading-6 text-rose-600">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="mt-3 text-sm font-bold text-rose-600 underline"
          >
            {t("retry")}
          </button>
        </div>
      ) : null}

      {state.kind === "pending" ? (
        <div className="mt-5 rounded-xl border border-amber-500/40 bg-neutral-100 p-4">
          <p className="text-sm font-semibold leading-6 text-amber-600">
            {state.message}
          </p>
          <a
            href={withStatus(successUrl, "pending")}
            className="mt-3 inline-block text-sm font-bold text-amber-600 underline"
          >
            {t("seeTrips")}
          </a>
        </div>
      ) : null}

      {state.kind === "verifying" ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">
          <SpinnerMini className="h-4 w-4" />
          {t("verifying")}
        </div>
      ) : null}

      {state.kind === "idle" ? (
        <button
          type="button"
          onClick={openWidget}
          disabled={!scriptReady}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-rose-500 text-sm font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {scriptReady
            ? t("pay", { amount: formatPrice(amount) })
            : t("loading")}
        </button>
      ) : null}

      {state.kind === "error" || state.kind === "idle" ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 h-11 w-full rounded-xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
        >
          {t("cancel")}
        </button>
      ) : null}
    </div>
  );
}
