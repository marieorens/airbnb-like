import React from "react";

import EmptyState from "@/components/EmptyState";
import ListingCard from "@/components/ListingCard";
import Heading from "@/components/Heading";

import { getCurrentUser } from "@/services/user";
import { getFavoriteListings } from "@/services/favorite";

const FavoritesPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return <EmptyState title="Connexion requise" subtitle="Veuillez vous connecter." />;
  }

  const favorites = await getFavoriteListings();

  if (favorites.length === 0) {
    return (
      <EmptyState
        title="Aucun favori trouve"
        subtitle="Vous n'avez encore ajoute aucune annonce en favori."
      />
    );
  }

  return (
    <section className="main-container">
      <Heading title="Favoris" subtitle="Les biens que vous avez sauvegardes." />
      <div className=" mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-8">
        {favorites.map((listing) => {
          return <ListingCard key={listing.id} data={listing} hasFavorited/>;
        })}
      </div>
    </section>
  );
};

export default FavoritesPage;
