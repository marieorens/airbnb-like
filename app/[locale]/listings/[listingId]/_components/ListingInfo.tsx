import React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import Avatar from "@/components/Avatar";
import ListingDescription from "./ListingDescription";
import ListingCategory from "./ListingCategory";
import { Category } from "@/types";
import { formatMoney } from "@/lib/currency";

interface ListingInfoProps {
  user: {
    image: string | null;
    name: string | null;
  };
  description: string;
  /** Texte d'origine, quand `description` est une traduction automatique. */
  originalDescription?: string;
  assetType: string;
  transactionType: string;
  currency: string;
  salePrice: number | null;
  monthlyRent: number | null;
  areaSqm: number | null;
  landTitleStatus: string | null;
  propertyCondition: string | null;
  availableFrom: string | null;
  addressDetails: string | null;
  guestCount: number;
  roomCount: number;
  bathroomCount: number;
  category: Category | undefined;
  latlng: number[];
  /** Coordonnées placées par l'annonceur (sinon : simple centre du pays). */
  hasPreciseLocation: boolean;
  /** Séjour vu par un visiteur : zone d'environ 500 m, pas de point exact. */
  approximateLocation?: boolean;
  /** Hôte qui consulte son séjour : rappel de ce que voient les visiteurs. */
  showHostLocationNote?: boolean;
}

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
});

const ListingInfo: React.FC<ListingInfoProps> = ({
  user,
  description,
  originalDescription,
  assetType,
  transactionType,
  currency,
  salePrice,
  monthlyRent,
  areaSqm,
  landTitleStatus,
  propertyCondition,
  availableFrom,
  addressDetails,
  guestCount,
  roomCount,
  bathroomCount,
  category,
  latlng,
  hasPreciseLocation,
  approximateLocation = false,
  showHostLocationNote = false,
}) => {
  const t = useTranslations("listing.info");
  const tDomain = useTranslations("domain");
  const detailItems = [
    [t("type"), tDomain.has(`assetTypes.${assetType}`) ? tDomain(`assetTypes.${assetType}`) : assetType],
    [t("transaction"), tDomain.has(`transactionKinds.${transactionType}`) ? tDomain(`transactionKinds.${transactionType}`) : transactionType],
    [t("area"), areaSqm ? `${areaSqm} m²` : null],
    [t("salePrice"), salePrice ? formatMoney(salePrice, currency) : null],
    [t("monthlyRent"), monthlyRent ? formatMoney(monthlyRent, currency) : null],
    [t("documents"), landTitleStatus],
    [t("condition"), propertyCondition],
    [t("availableFrom"), availableFrom],
    [t("address"), addressDetails],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="col-span-4 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="text-[16px] font-semibold flex flex-row items-center gap-2">
          <span className="mr-1">{t("postedBy")}</span> <Avatar src={user?.image} />
          <span> {user?.name}</span>
        </div>
        <div
          className="flex flex-row items-center gap-4 font-light text-neutral-700
          "
        >
          <span>{t("guests", { count: guestCount })}</span>
          <span>{t("rooms", { count: roomCount })}</span>
          <span>{t("bathrooms", { count: bathroomCount })}</span>
        </div>
      </div>
      <hr />
      {category && (
        <ListingCategory
          icon={category.icon}
          label={tDomain(`categories.${category.label}.label`)}
          description={tDomain(`categories.${category.label}.description`)}
        />
      )}
      <hr />
      {detailItems.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {detailItems.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold capitalize text-neutral-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <hr />
        </>
      )}
      <ListingDescription description={description} original={originalDescription} />
      <hr />
      <div className="h-[210px]">
        <Map
          center={latlng}
          zoom={approximateLocation ? 14 : hasPreciseLocation ? 15 : 4}
          areaRadius={approximateLocation && hasPreciseLocation ? 500 : undefined}
        />
      </div>
      {approximateLocation ? (
        <p className="-mt-4 text-xs font-medium text-neutral-500">{t("approximateLocation")}</p>
      ) : showHostLocationNote ? (
        <p className="-mt-4 text-xs font-medium text-neutral-500">{t("hostLocationNote")}</p>
      ) : null}
    </div>
  );
};

export default ListingInfo;
