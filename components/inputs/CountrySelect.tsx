"use client";
import React, { useEffect, useRef } from "react";
import Select from "react-select";
import { useLocale, useTranslations } from "next-intl";
import countries from "@/data/countries.json";

export type CountrySelectValue = {
  flag: string;
  label: string;
  latlng: number[];
  region: string;
  value: string;
};

const CountrySelect = ({
  value,
  onChange,
}: {
  value?: CountrySelectValue;
  onChange: (name: string, val: CountrySelectValue) => void;
}) => {
  const ref = useRef<any>(null);
  const locale = useLocale();
  const t = useTranslations("countrySelect");
  // Le libellé enregistré en base reste celui de countries.json ; l'affichage suit la langue.
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  const countryName = (option: CountrySelectValue) => {
    try {
      return regionNames.of(option.value) ?? option.label;
    } catch {
      return option.label;
    }
  };
  const continentName = (region: string) =>
    t.has(`continents.${region}`) ? t(`continents.${region}`) : region;

  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.focus();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleChange = (value: CountrySelectValue) => {
    onChange("location", value);
  };

  return (
    <Select
      ref={ref}
      placeholder={t("placeholder")}
      getOptionLabel={countryName}
      noOptionsMessage={() => t("noOptions")}
      isClearable
      options={countries}
      value={value}
      onChange={handleChange}
      formatOptionLabel={(option: any) => (
        <div className="flex flex-row items-center gap-3 z-[10]">
          <div>{option.flag}</div>
          <div>
            {countryName(option)},
            <span className="text-neutral-500 ml-1">{continentName(option.region)}</span>
          </div>
        </div>
      )}
      classNames={{
        control: () => "p-[6px] text-[14px] border-1",
        input: () => "text-[14px]",
        option: () => "text-[14px]",
      }}
      theme={(theme) => ({
        ...theme,
        borderRadius: 6,
        colors: {
          ...theme.colors,
          primary: "black",
          primary25: "#ffe4e6",
        },
      })}
    />
  );
};

export default CountrySelect;
