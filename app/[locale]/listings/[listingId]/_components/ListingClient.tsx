"use client";
import React, {
  ReactNode,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { differenceInCalendarDays, eachDayOfInterval } from "date-fns";
import { Range } from "react-date-range";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import ListingReservation from "./ListingReservation";
import VirtualTourSection from "./VirtualTourSection";
import { createPaymentSession } from "@/services/reservation-actions";
import { openConversation } from "@/lib/messaging";
import type { PaymentProvider } from "@/lib/payments";
import SpinnerMini from "@/components/Loader";
import { usePrice } from "@/components/CurrencyProvider";
import type { CurrentUser, Listing } from "@/types/listing";

const initialDateRange = {
  startDate: new Date(),
  endDate: new Date(),
  key: "selection",
};

interface ListingClientProps {
  reservations?: {
    startDate: Date;
    endDate: Date;
  }[];
  children: ReactNode;
  id: string;
  title: string;
  price: number;
  transactionType: string;
  currency: string;
  hostId: string;
  virtualTours?: Listing["virtualTours"];
  user:
    | CurrentUser
    | undefined;
}

const ListingClient: React.FC<ListingClientProps> = ({
  price,
  reservations = [],
  children,
  user,
  id,
  title,
  transactionType,
  currency,
  hostId,
  virtualTours = [],
}) => {
  const t = useTranslations("listing");
  const [totalPrice, setTotalPrice] = useState(price);
  const preferredPrice = usePrice(price, currency);
  const [dateRange, setDateRange] = useState<Range>(initialDateRange);
  const [provider, setProvider] = useState<PaymentProvider>(
    currency.toUpperCase() === "XOF" ? "kkiapay" : "stripe"
  );
  const [isLoading, startTransition] = useTransition();
  const router = useRouter();
  const disabledDates = useMemo(() => {
    let dates: Date[] = [];
    reservations.forEach((reservation) => {
      const range = eachDayOfInterval({
        start: new Date(reservation.startDate),
        end: new Date(reservation.endDate),
      });

      dates = [...dates, ...range];
    });
    return dates;
  }, [reservations]);

  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      const dayCount = differenceInCalendarDays(
        dateRange.endDate,
        dateRange.startDate
      );

      if (dayCount && price) {
        setTotalPrice((dayCount + 1) * price);
      } else {
        setTotalPrice(price);
      }
    }
  }, [dateRange.endDate, dateRange.startDate, price]);

  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const onSendMessage = async () => {
    if (!user) return toast.error(t("signInToMessage"));
    if (user.id === hostId) return;

    setIsOpeningChat(true);
    try {
      const conversationId = await openConversation({
        listingId: id,
        guestId: user.id,
        hostId,
      });
      router.push(`/messages?c=${conversationId}`);
    } catch {
      toast.error(t("conversationError"));
    } finally {
      setIsOpeningChat(false);
    }
  };

  const isOwnListing = user?.id === hostId;

  const messageButton =
    isOwnListing ? null : (
      <button
        type="button"
        onClick={onSendMessage}
        disabled={isOpeningChat}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-rose-500 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
      >
        {isOpeningChat ? <SpinnerMini className="h-4 w-4" /> : t("sendMessage")}
      </button>
    );

  const onCreateReservation = () => {
    if (!user) return toast.error(t("signInToBook"));

    /*
     * La policy d'insertion sur `bookings` exige un profil complet. On redirige
     * avant l'appel serveur : sinon l'erreur RLS arrive masquee en production.
     */
    if (!user.isProfileComplete) {
      router.push(`/complete-profile?next=/listings/${id}`);
      return;
    }

    startTransition(async () => {
      try {
        const { endDate, startDate } = dateRange;
        const res = await createPaymentSession({
          listingId: id,
          endDate,
          startDate,
          provider,
        });

        if (res.error) {
          toast.error(res.error);
          return;
        }

        if (res.url) {
          // URL externe (Stripe) ou page de paiement absolue : navigation complète.
          window.location.assign(res.url);
        }
      } catch (error: any) {
        toast.error(error?.message || t("paymentError"));
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 md:gap-10 mt-6">
      {children}

      <div className="order-first mb-10 md:order-last md:col-span-3">
        <div className="grid gap-5">
          {transactionType === "booking" ? (
            isOwnListing ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-neutral-900">
                  {t("ownListing")}
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-neutral-500">
                  {t("ownListingHint")}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <ListingReservation
                  price={price}
                  totalPrice={totalPrice}
                  currency={currency}
                  provider={provider}
                  onProviderChange={setProvider}
                  onChangeDate={(name, value) => setDateRange(value)}
                  dateRange={dateRange}
                  onSubmit={onCreateReservation}
                  isLoading={isLoading}
                  disabledDates={disabledDates}
                />
                {messageButton}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {transactionType === "sale" ? t("salePrice") : t("estimatedRent")}
              </p>
              <p className="mt-2 text-2xl font-black text-neutral-900">
                {preferredPrice.main}
              </p>
              {/* Prix converti : on rappelle le prix réel, payé dans la devise de l'annonce. */}
              {preferredPrice.approximate ? (
                <p className="mt-1 text-xs font-semibold text-neutral-500">
                  {t("originalPrice", { price: preferredPrice.original })}
                </p>
              ) : null}
              <p className="mt-4 text-sm font-medium leading-6 text-neutral-500">
                {t("contactHint")}
              </p>
              <div className="mt-5">{messageButton}</div>
            </div>
          )}

          {virtualTours.length ? (
            <VirtualTourSection tours={virtualTours} variant="sidebar" />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ListingClient;
