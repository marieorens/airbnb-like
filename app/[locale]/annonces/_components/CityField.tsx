"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import CitySelect from "@/components/inputs/CitySelect";

/** Champ « Ville » des filtres du catalogue, envoyé avec le formulaire GET. */
const CityField = ({
  country,
  value,
  labelClassName,
  controlClassName,
}: {
  country: string;
  value?: string;
  labelClassName: string;
  controlClassName: string;
}) => {
  const t = useTranslations("catalogue.advanced");
  const [city, setCity] = useState(value);

  return (
    <label className="block">
      <span className={labelClassName}>{t("city")}</span>
      <CitySelect
        country={country}
        name="city"
        value={city}
        onChange={setCity}
        className={controlClassName}
        labels={{
          allCities: t("allCities"),
          citiesWithListings: t("citiesWithListings"),
          otherCities: t("otherCities"),
          citiesLoading: t("citiesLoading"),
          cityCount: (count) => t("cityCount", { count }),
        }}
      />
    </label>
  );
};

export default CityField;
