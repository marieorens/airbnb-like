import React from "react";

import EmptyState from "@/components/EmptyState";
import ListingHead from "./_components/ListingHead";
import ListingInfo from "./_components/ListingInfo";
import ListingClient from "./_components/ListingClient";

import { getCurrentUser } from "@/services/user";
import { getListingById } from "@/services/listing";
import { categories } from "@/utils/constants";

interface IParams {
  listingId: string;
}

const ListingPage = async ({ params: { listingId } }: { params: IParams }) => {
  const listing = await getListingById(listingId);
  const currentUser = await getCurrentUser();

  if (!listing) return <EmptyState />;

  const {
    title,
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
    contactName,
    contactPhone,
    contactWhatsapp,
    contactEmail,
    description,
    roomCount,
    guestCount,
    bathroomCount,
    latlng,
    reservations,
    virtualTours,
  } = listing;

  const category = categories.find((cate) => cate.label === listing.category);

  return (
    <section className="main-container">
      <div className="flex flex-col gap-6">
        <ListingHead
          title={title}
          image={imageSrc}
          images={photos.map((photo) => photo.publicUrl)}
          country={country}
          region={region}
          id={id}
        />
      </div>

      <ListingClient
        id={id}
        price={price}
        reservations={reservations}
        user={currentUser}
        title={title}
        transactionType={transactionType}
        currency={currency}
        contactName={contactName}
        contactPhone={contactPhone}
        contactWhatsapp={contactWhatsapp}
        contactEmail={contactEmail}
        virtualTours={virtualTours}
      >
        <ListingInfo
          user={owner ?? { name: null, image: null }}
          category={category}
          description={description}
          assetType={assetType}
          transactionType={transactionType}
          currency={currency}
          salePrice={salePrice}
          monthlyRent={monthlyRent}
          areaSqm={areaSqm}
          landTitleStatus={landTitleStatus}
          propertyCondition={propertyCondition}
          availableFrom={availableFrom}
          addressDetails={addressDetails}
          roomCount={roomCount}
          guestCount={guestCount}
          bathroomCount={bathroomCount}
          latlng={latlng}
        />
      </ListingClient>
    </section>
  );
};

export default ListingPage;
