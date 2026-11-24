import React from "react";
import { Range } from "react-date-range";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import Button from "@/components/Button";
import SpinnerMini from "@/components/Loader";
import type { PaymentProvider } from "@/lib/payments";
import { formatMoney } from "@/lib/currency";
import { usePrice } from "@/components/CurrencyProvider";

interface ListingReservationProps {
  price: number;
  dateRange: Range;
  totalPrice: number;
  currency: string;
  provider: PaymentProvider;
  onProviderChange: (provider: PaymentProvider) => void;
  onChangeDate: (name: string, value: Range) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  disabledDates: Date[];
}

const Calendar = dynamic(() => import("@/components/Calender"), {
  ssr: false,
});

const ListingReservation: React.FC<ListingReservationProps> = ({
  price,
  dateRange,
  totalPrice,
  currency,
  provider,
  onProviderChange,
  onChangeDate,
  onSubmit,
  disabledDates,
  isLoading,
}) => {
  const t = useTranslations("listing.reservation");
  const kkiapayDisabled = currency.toUpperCase() !== "XOF";
  const approxTotal = usePrice(totalPrice, currency.toUpperCase());

  return (
    <div className="bg-white rounded-xl border-[1px] border-neutral-200 overflow-hidden">
      <div className="flex flex-row items-center gap-1 p-4">
        <span className="text-lg font-semibold">
          {formatMoney(price, currency.toUpperCase())}
        </span>
        <span className="font-light text-neutral-600">{t("night")}</span>
      </div>
      <hr />
      <Calendar
        value={dateRange}
        disabledDates={disabledDates}
        onChange={onChangeDate}
      />
      <hr />

      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
          {t("paymentMethod")}
        </p>
        <div className="mt-2 grid gap-2">
          <button
            type="button"
            onClick={() => onProviderChange("kkiapay")}
            disabled={kkiapayDisabled}
            className={`rounded-xl border p-3 text-left transition ${
              provider === "kkiapay"
                ? "border-rose-500 bg-white ring-2 ring-rose-500"
                : "border-neutral-200 bg-white hover:bg-neutral-50"
            } ${kkiapayDisabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <span className="block text-sm font-bold text-neutral-900">
              Kkiapay
            </span>
            <span className="mt-0.5 block text-xs font-medium text-neutral-500">
              {t("kkiapayHint")}
            </span>
            {kkiapayDisabled ? (
              <span className="mt-1 block text-[11px] font-semibold text-neutral-400">
                {t("kkiapayOnlyXof")}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => onProviderChange("stripe")}
            className={`rounded-xl border p-3 text-left transition ${
              provider === "stripe"
                ? "border-rose-500 bg-white ring-2 ring-rose-500"
                : "border-neutral-200 bg-white hover:bg-neutral-50"
            }`}
          >
            <span className="block text-sm font-bold text-neutral-900">
              Stripe
            </span>
            <span className="mt-0.5 block text-xs font-medium text-neutral-500">
              {t("stripeHint")}
            </span>
          </button>
        </div>
      </div>

      <hr />
      <div className="p-4">
        <Button
          disabled={isLoading}
          onClick={onSubmit}
          className="flex flex-row items-center justify-center h-[42px] "
          size="large"
        >
          {isLoading ? <SpinnerMini /> : <span>{t("payAndBook")}</span>}
        </Button>
      </div>
      <hr />
      <div className="p-4 flex flex-row items-center justify-between font-semibold text-lg">
        <span>{t("total")}</span>
        <span>
          {formatMoney(totalPrice, currency.toUpperCase())}
        </span>
      </div>
      {/* On paie dans la devise de l'annonce ; l'équivalent n'est qu'indicatif. */}
      {approxTotal.approximate ? (
        <p className="-mt-3 px-4 pb-4 text-right text-xs font-semibold text-neutral-500">
          {t("approxTotal", { amount: approxTotal.main })}
        </p>
      ) : null}
    </div>
  );
};

export default ListingReservation;
