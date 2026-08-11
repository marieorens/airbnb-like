import React from "react";
import dynamic from "next/dynamic";

import Avatar from "@/components/Avatar";
import ListingCategory from "./ListingCategory";
import { Category } from "@/types";

interface ListingInfoProps {
  user: {
    image: string | null;
    name: string | null;
  };
  description: string;
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
}

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
});

const assetTypeLabels: Record<string, string> = {
  short_stay: "Logement court sejour",
  house_rent: "Maison ou appartement a louer",
  house_sale: "Maison ou appartement a vendre",
  land_sale: "Parcelle ou terrain",
  commercial_rent: "Local commercial a louer",
  commercial_sale: "Local commercial a vendre",
  other: "Autre bien immobilier",
};

const transactionTypeLabels: Record<string, string> = {
  booking: "Reservation",
  rent: "Location",
  sale: "Vente",
  lead: "Contact",
};

const ListingInfo: React.FC<ListingInfoProps> = ({
  user,
  description,
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
}) => {
  const detailItems = [
    ["Type", assetTypeLabels[assetType] ?? assetType],
    ["Transaction", transactionTypeLabels[transactionType] ?? transactionType],
    ["Surface", areaSqm ? `${areaSqm} m2` : null],
    ["Prix de vente", salePrice ? `${currency} ${salePrice.toLocaleString("en-US")}` : null],
    ["Loyer mensuel", monthlyRent ? `${currency} ${monthlyRent.toLocaleString("en-US")}` : null],
    ["Documents", landTitleStatus],
    ["Etat", propertyCondition],
    ["Disponible le", availableFrom],
    ["Adresse", addressDetails],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="col-span-4 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="text-[16px] font-semibold flex flex-row items-center gap-2">
          <span className="mr-1">Publie par</span> <Avatar src={user?.image} />
          <span> {user?.name}</span>
        </div>
        <div
          className="flex flex-row items-center gap-4 font-light text-neutral-700
          "
        >
          <span>{guestCount} voyageur{guestCount > 1 ? "s" : ""}</span>
          <span>{roomCount} piece{roomCount > 1 ? "s" : ""}</span>
          <span>{bathroomCount} salle{bathroomCount > 1 ? "s" : ""} de bain</span>
        </div>
      </div>
      <hr />
      {category && (
        <ListingCategory
          icon={category.icon}
          label={category?.label}
          description={category?.description || ""}
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
      <p className=" font-light text-neutral-500 text-[16px] ">{description}</p>
      <hr />
      <div className="h-[210px]">
        <Map center={latlng} />
      </div>
    </div>
  );
};

export default ListingInfo;
