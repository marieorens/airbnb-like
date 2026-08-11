import React, { FC, Suspense } from "react";
import Link from "next/link";
import {
  MdArrowForward,
  MdHomeWork,
} from "react-icons/md";

import EmptyState from "@/components/EmptyState";
import ListingCard from "@/components/ListingCard";
import LoadMore from "@/components/LoadMore";

import { getFavorites } from "@/services/favorite";
import { getListings } from "@/services/listing";
import { assetTypes, categories } from "@/utils/constants";

interface AnnoncesPageProps {
  searchParams?: { [key: string]: string | undefined };
}

type FilterHref = Record<string, string | null>;

const AnnoncesPage: FC<AnnoncesPageProps> = async ({ searchParams }) => {
  const { listings, nextCursor } = await getListings(searchParams);
  const favorites = await getFavorites();

  const activeTransaction = searchParams?.transactionType ?? "";
  const activeAsset = searchParams?.assetType ?? "";
  const activeCategory = searchParams?.category ?? "";
  const hasFilters = Boolean(
    activeTransaction ||
      activeAsset ||
      searchParams?.category ||
      searchParams?.country ||
      searchParams?.region
  );

  const hrefWith = (updates: FilterHref) => {
    const params = new URLSearchParams();
    Object.entries(searchParams ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    return query ? `/annonces?${query}` : "/annonces";
  };

  const primaryFilters = [
    {
      label: "Tout",
      href: "/annonces",
      active: !activeTransaction && !activeAsset,
    },
    {
      label: "Sejours",
      href: hrefWith({ transactionType: "booking", assetType: null }),
      active: activeTransaction === "booking",
    },
    {
      label: "Locations",
      href: hrefWith({ transactionType: "rent", assetType: null }),
      active: activeTransaction === "rent",
    },
    {
      label: "Ventes",
      href: hrefWith({ transactionType: "sale", assetType: null }),
      active: activeTransaction === "sale" && !activeAsset,
    },
    {
      label: "Parcelles",
      href: hrefWith({ assetType: "land_sale", transactionType: "sale" }),
      active: activeAsset === "land_sale",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F5F5F2] pb-24 text-neutral-950">
      <section className="w-full px-3 pt-8 sm:px-5 lg:px-8 2xl:px-10">
        <div className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7 lg:p-9">
          <div className="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF1F2] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#BE123C]">
                <MdHomeWork size={16} />
                Catalogue
              </div>
              <h1 className="mt-5 max-w-5xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                Toutes les annonces
              </h1>
              <p className="mt-4 max-w-5xl text-sm font-medium leading-7 text-neutral-600 sm:text-base">
                Explorez les sejours, locations, ventes, parcelles et autres
                biens publies sur VacationHub.
              </p>
            </div>

            
          </div>

          <div className="mt-10 border-t border-neutral-100 pt-6">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-neutral-400">
              Objectif
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2">
            {primaryFilters.map((filter) => (
              <Link
                key={filter.label}
                href={filter.href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition ${
                  filter.active
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {filter.label}
              </Link>
            ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-neutral-400">
              Type de bien
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {assetTypes.map((asset) => (
                <Link
                  key={asset.value}
                  href={hrefWith({
                    assetType: activeAsset === asset.value ? null : asset.value,
                    transactionType:
                      activeAsset === asset.value ? null : asset.transactionType,
                  })}
                  className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-bold transition ${
                    activeAsset === asset.value
                      ? "border-[#E11D48] bg-[#FFF1F2] text-[#BE123C]"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-500"
                  }`}
                >
                  {asset.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-neutral-400">
              Ambiance du bien
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {categories.map((category) => {
                const Icon = category.icon;
                const isSelected = activeCategory === category.label;
                return (
                  <Link
                    key={category.label}
                    href={hrefWith({
                      category: isSelected ? null : category.label,
                    })}
                    className={`flex min-w-[92px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                      isSelected
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-500"
                    }`}
                  >
                    <Icon size={22} />
                    <span className="text-xs font-black">{category.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-3 pt-12 sm:px-5 lg:px-8 2xl:px-10">
        <div className="min-w-0">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E11D48]">
                Resultats
              </p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                Biens disponibles
              </h2>
              <p className="mt-2 text-sm font-semibold text-neutral-500">
                {listings.length} resultat{listings.length > 1 ? "s" : ""} trouve
                {listings.length > 1 ? "s" : ""}
                {hasFilters ? " avec vos filtres" : " au total"}
              </p>
            </div>
            {hasFilters ? (
              <Link
                href="/annonces"
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-700 transition hover:bg-neutral-950 hover:text-white"
              >
                Retirer tous les filtres
              </Link>
            ) : null}
          </div>

          {!listings || listings.length === 0 ? (
            <EmptyState
              title="Aucune annonce trouvee"
              subtitle="Essayez un autre type de bien ou retirez certains filtres."
              showReset
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(245px,1fr))] gap-6 2xl:gap-7">
              {listings.map((listing) => {
                const hasFavorited = favorites.includes(listing.id);
                return (
                  <ListingCard
                    key={listing.id}
                    data={listing}
                    hasFavorited={hasFavorited}
                  />
                );
              })}
              {nextCursor ? (
                <Suspense fallback={<></>}>
                  <LoadMore
                    nextCursor={nextCursor}
                    fnArgs={searchParams}
                    queryFn={getListings}
                    queryKey={["listings", searchParams]}
                    favorites={favorites}
                  />
                </Suspense>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default AnnoncesPage;
