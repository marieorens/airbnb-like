import React from "react";
import { getTranslations } from "next-intl/server";

import EmptyState from "@/components/EmptyState";
import ListingCard from "@/components/ListingCard";
import Heading from "@/components/Heading";

import { getCurrentUser } from "@/services/user";
import { getFavoriteListings } from "@/services/favorite";

const FavoritesPage = async () => {
  const t = await getTranslations("account");
  const user = await getCurrentUser();

  if (!user) {
    return <EmptyState title={t("signInRequired")} subtitle={t("signInPrompt")} />;
  }

  const favorites = await getFavoriteListings();

  if (favorites.length === 0) {
    return (
      <EmptyState
        title={t("favorites.emptyTitle")}
        subtitle={t("favorites.emptySubtitle")}
      />
    );
  }

  return (
    <section className="main-container">
      <Heading title={t("favorites.title")} subtitle={t("favorites.subtitle")} />
      <div className=" mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-8">
        {favorites.map((listing) => {
          return <ListingCard key={listing.id} data={listing} hasFavorited/>;
        })}
      </div>
    </section>
  );
};

export default FavoritesPage;
