"use client";
import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import queryString from "query-string";
import { format } from "date-fns";

import Modal from "./Modal";
import Button from "../Button";
import Heading from "../Heading";
import Counter from "../inputs/Counter";
import CitySelect from "../inputs/CitySelect";
import CountrySelect from "../inputs/CountrySelect";
import { useRouter } from "@/i18n/navigation";

const Calendar = dynamic(() => import("@/components/Calender"), { ssr: false });

const steps = {
  "0": "location",
  "1": "dateRange",
  "2": "guestCount",
};

enum STEPS {
  LOCATION = 0,
  DATE = 1,
  INFO = 2,
}

const SearchModal = ({ onCloseModal }: { onCloseModal?: () => void }) => {
  const t = useTranslations("searchModal");
  const tCommon = useTranslations("common");
  const [step, setStep] = useState(STEPS.LOCATION);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { handleSubmit, setValue, watch, getValues } = useForm<FieldValues>({
    defaultValues: {
      location: null,
      guestCount: 1,
      bathroomCount: 1,
      roomCount: 1,
      dateRange: {
        startDate: new Date(),
        endDate: new Date(),
        key: "selection",
      },
    },
  });

  const location = watch("location");
  const dateRange = watch("dateRange");
  const country = location?.label;
  // Ville rattachée au pays où elle a été choisie : changer de pays l'oublie.
  const [cityChoice, setCityChoice] = useState<{ country?: string; city?: string }>({});
  const city = cityChoice.country === country ? cityChoice.city : undefined;
  const stepItems = [t("steps.destination"), t("steps.dates"), t("steps.capacity")];
  const progress = Math.round(((step + 1) / stepItems.length) * 100);

  const Map = useMemo(
    () =>
      dynamic(() => import("../Map"), {
        ssr: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [country]
  );

  const setCustomValue = (id: string, value: any) => {
    setValue(id, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const onBack = () => {
    setStep((value) => value - 1);
  };

  const onNext = () => {
    setStep((value) => value + 1);
  };

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    if (step !== STEPS.INFO) return onNext();
    const { guestCount, roomCount, bathroomCount, dateRange } = data;

    let currentQuery = {};

    if (searchParams) {
      currentQuery = queryString.parse(searchParams.toString());
    }

    const updatedQuery: any = {
      ...currentQuery,
      country: location?.label,
      city: country ? city : undefined,
      guestCount,
      roomCount,
      bathroomCount,
    };

    if (dateRange.startDate) {
      // Jour seul (AAAA-MM-JJ) : c'est le format attendu par le filtre du catalogue.
      updatedQuery.startDate = format(dateRange.startDate, "yyyy-MM-dd");
    }

    if (dateRange.endDate) {
      updatedQuery.endDate = format(dateRange.endDate, "yyyy-MM-dd");
    }

    const url = queryString.stringifyUrl(
      {
        url: "/annonces",
        query: updatedQuery,
      },
      { skipNull: true }
    );
    onCloseModal?.();
    router.push(url);
  };

  const body = () => {
    switch (step) {
      case STEPS.DATE:
        return (
          <div className="flex flex-col gap-3">
            <Heading title={t("datesTitle")} subtitle={t("datesSubtitle")} />
            <div className="h-[348px] w-full overflow-hidden rounded-2xl border border-neutral-200">
              <Calendar onChange={setCustomValue} value={dateRange} />
            </div>
          </div>
        );

      case STEPS.INFO:
        return (
          <div className="flex flex-col gap-6">
            <Heading
              title={t("capacityTitle")}
              subtitle={t("capacitySubtitle")}
            />
            <Counter
              title={t("guests")}
              subtitle={t("guestsHint")}
              watch={watch}
              onChange={setCustomValue}
              name="guestCount"
            />
            <hr />
            <Counter
              onChange={setCustomValue}
              watch={watch}
              title={t("rooms")}
              subtitle={t("roomsHint")}
              name="roomCount"
            />
            <hr />
            <Counter
              onChange={setCustomValue}
              watch={watch}
              title={t("bathrooms")}
              subtitle={t("bathroomsHint")}
              name="bathroomCount"
            />
          </div>
        );

      default:
        return (
          <div className="flex flex-col gap-4">
            <Heading
              title={t("whereTitle")}
              subtitle={t("whereSubtitle")}
            />
            <CountrySelect value={location} onChange={setCustomValue} />
            {country ? (
              <label className="flex flex-col gap-2 text-sm font-semibold text-neutral-700">
                {t("city")}
                <CitySelect
                  country={country}
                  value={city}
                  onChange={(value) => setCityChoice({ country, city: value })}
                  className="h-[46px] rounded-lg border border-neutral-300 bg-white px-3 text-[15px] font-medium text-neutral-900 outline-none transition focus:border-neutral-900"
                  labels={{
                    allCities: t("allCities"),
                    citiesWithListings: t("citiesWithListings"),
                    otherCities: t("otherCities"),
                    citiesLoading: t("citiesLoading"),
                    cityCount: (count) => t("cityCount", { count }),
                  }}
                />
              </label>
            ) : null}
            <div className="h-[240px] overflow-hidden rounded-2xl border border-neutral-200">
              <Map center={location?.latlng} />
            </div>
          </div>
        );
    }
  };

  const isFieldFilled = !!getValues(steps[step]);

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <Modal.WindowHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <form
        className="grid min-h-0 flex-1 bg-white outline-none focus:outline-none md:grid-cols-[280px_1fr]"
        onSubmit={handleSubmit(onSubmit)}
      >
        <aside className="hidden border-r border-neutral-200 bg-neutral-950 p-6 text-white md:block">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-300">
            {t("asideKicker")}
          </p>
          <h2 className="mt-4 text-2xl font-black leading-tight">
            {t("asideTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            {t("asideText")}
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-rose-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-6 grid gap-2">
            {stepItems.map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                  index === step
                    ? "bg-white text-neutral-950"
                    : index < step
                    ? "bg-white/10 text-white"
                    : "text-neutral-400"
                }`}
              >
                {index + 1}. {item}
              </div>
            ))}
          </div>
        </aside>
        <div className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto p-5 md:p-8">
            <div className="mx-auto max-w-[620px]">{body()}</div>
          </div>
          <div className="sticky bottom-0 border-t border-neutral-200 bg-white/95 px-5 py-4 backdrop-blur md:px-8">
            <div className="mx-auto flex max-w-[620px] flex-row items-center gap-3">
              {step !== STEPS.LOCATION ? (
                <Button
                  type="button"
                  className="flex h-11 items-center justify-center rounded-xl"
                  onClick={onBack}
                  outline
                >
                  {tCommon("back")}
                </Button>
              ) : null}
              <Button
                type="submit"
                className="flex h-11 items-center justify-center rounded-xl bg-neutral-950 text-sm font-black hover:bg-neutral-800"
                disabled={!isFieldFilled}
              >
                {step === STEPS.INFO ? t("search") : t("continue")}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SearchModal;
