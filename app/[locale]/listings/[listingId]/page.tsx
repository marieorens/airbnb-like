import React from "react";

import EmptyState from "@/components/EmptyState";
import ListingHead from "./_components/ListingHead";
import ListingInfo from "./_components/ListingInfo";
import ListingClient from "./_components/ListingClient";

import { getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/services/user";
import { getListingById } from "@/services/listing";
import { categories } from "@/utils/constants";
import { pickListingText } from "@/utils/listingText";

interface IParams {
  listingId: string;
}

const ListingPage = async ({ params: { listingId } }: { params: IParams }) => {
  const listing = await getListingById(listingId);
  const currentUser = await getCurrentUser();

  if (!listing) return <EmptyState />;

  const locale = await getLocale();
  const text = pickListingText(listing, locale);

  const {
    imageSrc,
    photos,
    country,
    region,
    id,
    user: owner,
    price,
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
    roomCount,
    guestCount,
    bathroomCount,
    latlng,
    city,
    district,
    reservations,
    virtualTours,
  } = listing;

  const category = categories.find((cate) => cate.label === listing.category);

  // Séjour : le point exact et l'adresse vivent dans une table privée, lisible
  // par l'hôte, les admins et les voyageurs confirmés (migration 202611190002).
  // Les autres visiteurs ne voient qu'une zone autour d'un point décalé.
  const isStay = transactionType === "booking";
  const { data: exactLocation } = isStay
    ? await createClient()
        .from("listing_private_locations")
        .select("latitude, longitude, address_details")
        .eq("listing_id", id)
        .maybeSingle()
    : { data: null };
  const shownLatLng =
    exactLocation?.latitude != null && exactLocation.longitude != null
      ? [exactLocation.latitude, exactLocation.longitude]
      : latlng;
  const shownAddress = isStay ? (exactLocation?.address_details ?? null) : addressDetails;

  return (
    <section className="main-container">
      <div className="flex flex-col gap-6">
        <ListingHead
          title={text.title}
          image={imageSrc}
          images={photos.map((photo) => photo.publicUrl)}
          country={country}
          region={region}
          city={city}
          district={district}
          id={id}
        />
      </div>

      <ListingClient
        id={id}
        price={price}
        reservations={reservations}
        user={currentUser}
        title={text.title}
        transactionType={transactionType}
        currency={currency}
        hostId={listing.userId}
        virtualTours={virtualTours}
      >
        <ListingInfo
          user={owner ?? { name: null, image: null }}
          category={category}
          description={text.description}
          originalDescription={text.translated ? listing.description : undefined}
          assetType={assetType}
          transactionType={transactionType}
          currency={currency}
          salePrice={salePrice}
          monthlyRent={monthlyRent}
          areaSqm={areaSqm}
          landTitleStatus={landTitleStatus}
          propertyCondition={propertyCondition}
          availableFrom={availableFrom}
          addressDetails={shownAddress}
          roomCount={roomCount}
          guestCount={guestCount}
          bathroomCount={bathroomCount}
          latlng={shownLatLng}
          hasPreciseLocation={Boolean(city)}
          approximateLocation={isStay && !exactLocation}
          showHostLocationNote={isStay && currentUser?.id === listing.userId}
        />
      </ListingClient>
    </section>
  );
};

export default ListingPage;
