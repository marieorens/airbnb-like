import React from "react";

import Heading from "@/components/Heading";
import { getFavorites } from "@/services/favorite";
import ListingImageCarousel from "./ListingImageCarousel";

interface ListingHeadProps {
  title: string;
  country: string | null;
  region: string | null;
  image: string;
  images: string[];
  id: string;
}

const ListingHead: React.FC<ListingHeadProps> = async ({
  title,
  country = "",
  region = "",
  image,
  images,
  id,
}) => {
  const favorites = await getFavorites();
  const hasFavorited = favorites.includes(id);
  const gallery = images.length ? images : [image];

  return (
    <>
      <Heading title={title} subtitle={`${region}, ${country}`} backBtn/>
      <ListingImageCarousel
        title={title}
        listingId={id}
        images={gallery}
        hasFavorited={hasFavorited}
      />
    </>
  );
};

export default ListingHead;
