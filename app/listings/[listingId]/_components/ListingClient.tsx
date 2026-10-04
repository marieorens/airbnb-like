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
import { useRouter } from "next/navigation";

import ListingReservation from "./ListingReservation";
import VirtualTourSection from "./VirtualTourSection";
import { createPaymentSession } from "@/services/reservation-actions";
import { openConversation } from "@/lib/messaging";
import SpinnerMini from "@/components/Loader";
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
  const [totalPrice, setTotalPrice] = useState(price);
  const [dateRange, setDateRange] = useState<Range>(initialDateRange);
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
    if (!user) return toast.error("Connectez-vous pour envoyer un message.");
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
      toast.error("Impossible d'ouvrir la conversation.");
    } finally {
      setIsOpeningChat(false);
    }
  };

  const messageButton =
    user?.id === hostId ? null : (
      <button
        type="button"
        onClick={onSendMessage}
        disabled={isOpeningChat}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-rose-500 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
      >
        {isOpeningChat ? <SpinnerMini className="h-4 w-4" /> : "Envoyer un message"}
      </button>
    );

  const onCreateReservation = () => {
    if (!user) return toast.error("Please log in to reserve listing.");
    startTransition(async () => {
      try {
        const { endDate, startDate } = dateRange;
        const res = await createPaymentSession({
          listingId: id,
          endDate,
          startDate,
          totalPrice,
        });

        if(res?.url){
          router.push(res.url);
        }
      } catch (error: any) {
        toast.error(error?.message);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 md:gap-10 mt-6">
      {children}

      <div className="order-first mb-10 md:order-last md:col-span-3">
        <div className="grid gap-5">
          {transactionType === "booking" ? (
            <div className="grid gap-3">
              <ListingReservation
                price={price}
                totalPrice={totalPrice}
                onChangeDate={(name, value) => setDateRange(value)}
                dateRange={dateRange}
                onSubmit={onCreateReservation}
                isLoading={isLoading}
                disabledDates={disabledDates}
              />
              {messageButton}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {transactionType === "sale" ? "Prix de vente" : "Loyer estimé"}
              </p>
              <p className="mt-2 text-2xl font-black text-neutral-900">
                {currency} {price.toLocaleString("en-US")}
              </p>
              <p className="mt-4 text-sm font-medium leading-6 text-neutral-500">
                Échangez directement avec l&apos;annonceur depuis VacationHub : vos messages
                restent rattachés à l&apos;annonce.
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
