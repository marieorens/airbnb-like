import React from "react";
import { format } from "date-fns";
import Skeleton from "react-loading-skeleton";
import { FiMapPin } from "react-icons/fi";
import { useLocale, useTranslations } from "next-intl";

import { pickListingText } from "@/utils/listingText";

import HeartButton from "./HeartButton";
import Image from "./Image";
import ListingMenu from "./ListingMenu";

import type { ListingLike } from "@/types/listing";
import PreferredPrice from "@/components/PreferredPrice";
import { formatMoney } from "@/lib/currency";
import { getDateLocale } from "@/utils/dateLocale";
import { Link } from "@/i18n/navigation";

interface ListingCardProps {
  data: ListingLike;
  reservation?: {
    id: string;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    status?: string;
  };
  hasFavorited: boolean;
  /** Distance depuis la position de l'utilisateur (« Autour de moi »). */
  distanceKm?: number;
}

const ListingCard: React.FC<ListingCardProps> = ({
  data,
  reservation,
  hasFavorited,
  distanceKm,
}) => {
  const t = useTranslations("listingCard");
  const tDomain = useTranslations("domain");
  const locale = useLocale();
  const sortedPhotos = [...(data.listing_photos ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  const imageSrc =
    data.imageSrc ||
    data.image_src ||
    sortedPhotos[0]?.public_url ||
    sortedPhotos[0]?.storage_path ||
    "/images/placeholder.jpg";
  const price = reservation
    ? reservation.totalPrice
    : data?.price ?? data?.price_per_night ?? 0;
  const currency = data.currency || "USD";
  // Une réservation garde le montant réellement payé, dans sa devise.
  const priceText = reservation ? (
    formatMoney(price, currency)
  ) : (
    <PreferredPrice amount={price} currency={currency} />
  );
  const transactionType =
    data.transactionType || data.transaction_type || "booking";
  const assetType = data.assetType || data.asset_type || "short_stay";
  const assetLabel = tDomain.has(`assetTypes.${assetType}`)
    ? tDomain(`assetTypes.${assetType}`)
    : t("defaultAsset");
  const transactionLabel = tDomain.has(`transactionBadges.${transactionType}`)
    ? tDomain(`transactionBadges.${transactionType}`)
    : tDomain("transactionBadges.booking");
  const priceSuffix =
    reservation || transactionType === "sale" || transactionType === "lead"
      ? ""
      : transactionType === "rent"
        ? t("perMonth")
        : t("perNight");
  // Ville si elle est connue ; les anciennes annonces n'ont que le continent (`region`).
  const place = data.city || data.region || "";
  const country = data.country || "";
  const location = [place, country].filter(Boolean).join(", ") || data.title;

  let reservationDate;
  if (reservation) {
    const start = new Date(reservation.startDate);
    const end = new Date(reservation.endDate);
    const dateLocale = getDateLocale(locale);
    reservationDate = `${format(start, "PP", { locale: dateLocale })} - ${format(end, "PP", { locale: dateLocale })}`;
  }

  return (
    <div className="group relative">
      <div className="absolute left-0 top-0 z-[5] flex w-full items-center justify-between p-3">
        <div className="z-5">
          <ListingMenu id={reservation?.id || data.id} />
        </div>

        <div className="flex h-[28px] w-[28px] items-center justify-center">
          <HeartButton
            listingId={data.id}
            key={data.id}
            hasFavorited={hasFavorited}
          />
        </div>
      </div>
      <Link href={`/listings/${data.id}`} className="col-span-1 block cursor-pointer">
        <article className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_44px_rgba(15,23,42,0.12)]">
          <div className="overflow-hidden">
            <div className="relative aspect-[1/0.82] bg-neutral-100">
              <Image
                imageSrc={imageSrc.replace(
                  /\.supabase\.co\/rest\/v1\//,
                  ".supabase.co/"
                )}
                fill
                alt={pickListingText(data, locale).title}
                effect="zoom"
                className="object-cover"
                sizes="100vw"
              />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral-950/70 to-transparent" />
              <span
                className={`absolute bottom-3 left-3 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm ${
                  reservation?.status === "pending_payment"
                    ? "bg-amber-100 text-amber-800"
                    : reservation?.status === "confirmed"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-white text-neutral-950"
                }`}
              >
                {reservation?.status === "pending_payment"
                  ? t("pending")
                  : reservation?.status === "confirmed"
                  ? t("confirmed")
                  : transactionLabel}
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-start gap-2">
              <FiMapPin className="mt-1 shrink-0 text-[#E11D48]" size={15} />
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-black text-neutral-950">
                  {location}
                </h3>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-neutral-500">
                  {reservationDate || assetLabel || data.category}
                </p>
                {distanceKm !== undefined ? (
                  <p className="mt-1 text-xs font-black text-[#E11D48]">
                    {t("distance", {
                      distance: new Intl.NumberFormat(locale, {
                        maximumFractionDigits: distanceKm < 10 ? 1 : 0,
                      }).format(distanceKm),
                    })}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                  {reservation ? t("total") : t("price")}
                </p>
                <div className="flex flex-row items-baseline gap-1">
                  <span className="text-[16px] font-black text-neutral-950">
                    {priceText}
                  </span>
                  {priceSuffix ? (
                    <span className="text-xs font-semibold text-neutral-500">
                      / {priceSuffix}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-black text-neutral-600">
                {t("details")}
              </span>
            </div>
          </div>
        </article>
      </Link>
    </div>
  );
};

export default ListingCard;

export const ListingSkeleton = () => {
  return (
    <div className="col-span-1">
      <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white p-3 shadow-sm">
        <Skeleton
          width="100%"
          height="100%"
          borderRadius="18px"
          className="aspect-[1/0.82]"
        />
        <div className="mt-4 flex flex-row gap-3">
          <Skeleton height="18px" width="84px" />
          <Skeleton height="18px" width="84px" />
        </div>
        <Skeleton height="16px" width="102px" />
        <Skeleton height="18px" width="132px" />
      </div>
    </div>
  );
};
