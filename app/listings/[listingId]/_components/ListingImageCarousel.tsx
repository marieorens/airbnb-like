"use client";

import React, { useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import HeartButton from "@/components/HeartButton";
import Image from "@/components/Image";

interface ListingImageCarouselProps {
  title: string;
  listingId: string;
  images: string[];
  hasFavorited: boolean;
}

const ListingImageCarousel: React.FC<ListingImageCarouselProps> = ({
  title,
  listingId,
  images,
  hasFavorited,
}) => {
  const gallery = useMemo(
    () => (images.length ? images : ["/images/placeholder.jpg"]),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultipleImages = gallery.length > 1;

  const goToPrevious = () => {
    setActiveIndex((current) =>
      current === 0 ? gallery.length - 1 : current - 1
    );
  };

  const goToNext = () => {
    setActiveIndex((current) =>
      current === gallery.length - 1 ? 0 : current + 1
    );
  };

  return (
    <div className="relative overflow-hidden rounded-[26px] bg-neutral-100">
      <div className="relative h-[300px] w-full sm:h-[390px] lg:h-[500px]">
        <Image
          key={gallery[activeIndex]}
          imageSrc={gallery[activeIndex]}
          fill
          className="object-cover"
          alt={`${title} - photo ${activeIndex + 1}`}
          sizes="100vw"
          priority={activeIndex === 0}
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-neutral-950/55 to-transparent" />

        <div className="absolute right-4 top-4">
          <HeartButton listingId={listingId} hasFavorited={hasFavorited} />
        </div>

        {hasMultipleImages ? (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              aria-label="Photo precedente"
              className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-950 shadow-sm transition hover:bg-white"
            >
              <FiChevronLeft size={23} />
            </button>
            <button
              type="button"
              onClick={goToNext}
              aria-label="Photo suivante"
              className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-950 shadow-sm transition hover:bg-white"
            >
              <FiChevronRight size={23} />
            </button>
            <div className="absolute bottom-4 left-4 rounded-full bg-white/92 px-4 py-2 text-xs font-black text-neutral-950 shadow-sm">
              {activeIndex + 1} / {gallery.length}
            </div>
          </>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <div className="flex gap-2 overflow-x-auto bg-white p-3">
          {gallery.map((image, index) => (
            <button
              type="button"
              key={`${image}-${index}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Afficher la photo ${index + 1}`}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-20 sm:w-32 ${
                activeIndex === index
                  ? "border-[#E11D48]"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                imageSrc={image}
                fill
                className="object-cover"
                alt={`${title} - miniature ${index + 1}`}
                sizes="128px"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ListingImageCarousel;
