"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { MdMyLocation } from "react-icons/md";

import { useRouter } from "@/i18n/navigation";

/**
 * « Autour de moi » : demande la position au navigateur, puis ouvre le
 * catalogue en mode proximité. La position est arrondie à environ 100 m avant
 * de partir dans l'URL : elle suffit au tri par distance.
 */
const NearMeButton = ({ active }: { active: boolean }) => {
  const t = useTranslations("catalogue.nearMe");
  const router = useRouter();
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("unsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        router.push(`/annonces?near=${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)}`);
      },
      () => {
        setLocating(false);
        toast.error(t("failed"));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  return (
    <button
      type="button"
      onClick={locate}
      disabled={locating}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-black transition disabled:opacity-60 ${
        active
          ? "border-neutral-950 bg-neutral-950 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-950"
      }`}
    >
      <MdMyLocation size={18} />
      {locating ? t("locating") : t("button")}
    </button>
  );
};

export default NearMeButton;
