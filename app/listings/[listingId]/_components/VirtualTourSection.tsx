"use client";

import React, { useRef, useState } from "react";
import { FiExternalLink, FiMove, FiRotateCcw } from "react-icons/fi";

import type { Listing } from "@/types/listing";
import { virtualTourProviderLabels } from "@/utils/virtualTour";

interface VirtualTourSectionProps {
  tours: Listing["virtualTours"];
  variant?: "content" | "sidebar";
}

const normalizePosition = (value: number) => ((value % 100) + 100) % 100;

const PanoramaViewer = ({
  imageUrl,
  isSidebar,
}: {
  imageUrl: string;
  isSidebar: boolean;
}) => {
  const [position, setPosition] = useState(50);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startPosition: 50,
  });

  return (
    <div
      role="application"
      aria-label="Viewer panorama 360"
      className={[
        "group relative cursor-grab overflow-hidden rounded-[18px] bg-neutral-950 active:cursor-grabbing",
        isSidebar ? "h-[240px]" : "h-[320px] md:h-[460px]",
      ].join(" ")}
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.28)), url(${imageUrl})`,
        backgroundPosition: `${position}% center`,
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
      }}
      onPointerDown={(event) => {
        dragRef.current = {
          active: true,
          startX: event.clientX,
          startPosition: position,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current.active) return;
        const delta = event.clientX - dragRef.current.startX;
        setPosition(normalizePosition(dragRef.current.startPosition - delta * 0.08));
      }}
      onPointerUp={(event) => {
        dragRef.current.active = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current.active = false;
      }}
    >
      <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-black text-neutral-950 shadow-sm">
        <FiMove size={14} />
        Glisser
      </div>
      <button
        type="button"
        onClick={() => setPosition(50)}
        className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-950 shadow-sm transition hover:scale-105"
        aria-label="Recentrer le panorama"
      >
        <FiRotateCcw size={16} />
      </button>
    </div>
  );
};

const VirtualTourSection: React.FC<VirtualTourSectionProps> = ({
  tours,
  variant = "content",
}) => {
  const isSidebar = variant === "sidebar";
  const [activeTourId, setActiveTourId] = useState(tours[0]?.id ?? "0");
  const activeTour =
    tours.find((tour) => tour.id === activeTourId) ?? tours[0];

  if (!activeTour) return null;

  const tour = activeTour;
  const isPanorama = tour.sourceType === "panorama" || tour.provider === "panorama";

  return (
    <section
      className={[
        "border border-neutral-200 bg-white shadow-sm",
        isSidebar
          ? "rounded-xl p-4"
          : "col-span-4 rounded-[24px] p-4",
      ].join(" ")}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E11D48]">
            Visite virtuelle
          </p>
          <h2
            className={[
              "mt-2 font-black text-neutral-950",
              isSidebar ? "text-base" : "text-xl",
            ].join(" ")}
          >
            Explorer le bien a distance
          </h2>
          <p className="mt-1 text-sm font-medium text-neutral-500">
            Source: {virtualTourProviderLabels[tour.provider]}
          </p>
        </div>
        <a
          href={tour.tourUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-300 px-4 text-sm font-black text-neutral-700 transition hover:bg-neutral-950 hover:text-white"
        >
          Ouvrir
          <FiExternalLink size={15} />
        </a>
      </div>
      {tours.length > 1 ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tours.map((item, index) => {
            const isActive = item.id === activeTourId;

            return (
              <button
                key={item.id || `${item.embedUrl}-${index}`}
                type="button"
                onClick={() => setActiveTourId(item.id)}
                className={[
                  "shrink-0 rounded-full px-3 py-2 text-xs font-black transition",
                  isActive
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-950",
                ].join(" ")}
              >
                {item.roomLabel || `Piece ${index + 1}`}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[18px] bg-neutral-100">
        {isPanorama ? (
          <PanoramaViewer imageUrl={tour.embedUrl} isSidebar={isSidebar} />
        ) : (
          <iframe
            src={tour.embedUrl}
            title="Visite virtuelle du bien"
            className={[
              "w-full border-0",
              isSidebar ? "h-[240px]" : "h-[320px] md:h-[460px]",
            ].join(" ")}
            allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </section>
  );
};

export default VirtualTourSection;
