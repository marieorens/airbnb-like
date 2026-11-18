"use client";
import React, { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { BiDollar } from "react-icons/bi";

import Modal from "./Modal";
import Button from "../Button";
import SpinnerMini from "../Loader";
import Heading from "../Heading";
import Counter from "../inputs/Counter";
import Input from "../inputs/Input";
import CategoryButton from "../inputs/CategoryButton";
import CountrySelect from "../inputs/CountrySelect";
import ImageUpload from "../ImageUpload";
import VirtualTourUpload from "../VirtualTourUpload";

import { assetTypes, categories, currencies } from "@/utils/constants";
import { createListing } from "@/services/listing-actions";

const steps = {
  "0": "assetType",
  "1": "category",
  "2": "location",
  "3": "guestCount",
  "4": "images",
  "5": "title",
};

enum STEPS {
  ASSET = 0,
  CATEGORY = 1,
  LOCATION = 2,
  INFO = 3,
  IMAGES = 4,
  DESCRIPTION = 5,
  PRICE = 6,
}

const RentModal = ({ onCloseModal }: { onCloseModal?: () => void }) => {
  const t = useTranslations("rentModal");
  const tDomain = useTranslations("domain");
  const tCommon = useTranslations("common");
  const [step, setStep] = useState(STEPS.ASSET);
  const [isLoading, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
    getValues,
  } = useForm<FieldValues>({
    defaultValues: {
      assetType: "short_stay",
      category: "Plage",
      location: null,
      city: "",
      district: "",
      coordinates: null,
      guestCount: 1,
      bathroomCount: 1,
      roomCount: 1,
      image: "",
      images: [],
      price: "",
      salePrice: "",
      monthlyRent: "",
      currency: "USD",
      areaSqm: "",
      landTitleStatus: "",
      propertyCondition: "",
      availableFrom: "",
      addressDetails: "",
      title: "",
      description: "",
      virtualTourMode: "external",
      virtualTourUrl: "",
      virtualTourPanoramas: [],
    },
  });

  const location = watch("location");
  const country = location?.label;
  const city = (watch("city") as string | undefined) ?? "";
  const coordinates = watch("coordinates") as [number, number] | null;
  // Où la carte doit se centrer après « Utiliser ma position » (sinon : le pays choisi).
  const [mapFocus, setMapFocus] = useState<{ center: number[]; zoom: number } | null>(
    null
  );
  const [isLocating, setIsLocating] = useState(false);
  const assetType = watch("assetType") || "short_stay";
  const virtualTourMode = watch("virtualTourMode") || "external";
  const selectedAsset = assetTypes.find((asset) => asset.value === assetType);
  const transactionType = selectedAsset?.transactionType ?? "booking";
  const usesLifestyleCategory = ["short_stay", "house_rent", "house_sale"].includes(
    assetType
  );
  const stepItems = [
    { step: STEPS.ASSET, label: t("steps.type") },
    ...(usesLifestyleCategory
      ? [{ step: STEPS.CATEGORY, label: t("steps.category") }]
      : []),
    { step: STEPS.LOCATION, label: t("steps.address") },
    { step: STEPS.INFO, label: assetType === "land_sale" ? t("steps.land") : t("steps.details") },
    { step: STEPS.IMAGES, label: t("steps.photos") },
    { step: STEPS.DESCRIPTION, label: t("steps.description") },
    { step: STEPS.PRICE, label: t("steps.price") },
  ];
  const currentStepIndex = Math.max(
    stepItems.findIndex((item) => item.step === step),
    0
  );
  const progress = Math.round(((currentStepIndex + 1) / stepItems.length) * 100);

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

  const selectCountry = (name: string, value: unknown) => {
    setCustomValue(name, value);
    // Nouveau pays : l'ancien repère n'a plus de sens.
    setCustomValue("coordinates", null);
    setMapFocus(null);
  };

  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("geoUnsupported"));
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setCustomValue("coordinates", point);
        setMapFocus({ center: point, zoom: 16 });
        setIsLocating(false);
      },
      () => {
        toast.error(t("geoFailed"));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const selectAssetType = (value: string) => {
    const asset = assetTypes.find((item) => item.value === value);
    setCustomValue("assetType", value);
    if (asset && !["short_stay", "house_rent", "house_sale"].includes(value)) {
      setCustomValue("category", asset.label);
    }
  };

  const goToRelativeStep = (direction: 1 | -1) => {
    const nextIndex = currentStepIndex + direction;
    const nextStep = stepItems[nextIndex]?.step;
    if (typeof nextStep === "number") setStep(nextStep);
  };

  const onBack = () => {
    goToRelativeStep(-1);
  };

  const onNext = () => {
    goToRelativeStep(1);
  };

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    if (step !== STEPS.PRICE) return onNext();

    startTransition(async () => {
      try {
        const newListing = await createListing(data);
        toast.success(t("submitted", { title: data.title }));
        queryClient.invalidateQueries({
          queryKey: ["listings"],
        });
        reset();
        setStep(STEPS.ASSET);
        onCloseModal?.();
        router.refresh();
        router.push(`/listings/${newListing.id}`);
      } catch (error: any) {
        toast.error(t("submitError"));
        console.log(error?.message)
      }
    });
  };

  const body = () => {
    switch (step) {
      case STEPS.ASSET:
        return (
          <div className="flex flex-col gap-4">
            <Heading
              title={t("assetTitle")}
              subtitle={t("assetSubtitle")}
            />
            <div className="grid grid-cols-1 gap-3">
              {assetTypes.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => selectAssetType(item.value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    assetType === item.value
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_18px_38px_rgba(15,23,42,0.18)]"
                      : "border-neutral-200 bg-white hover:border-neutral-500"
                  }`}
                >
                  <span
                    className={`block text-[15px] font-bold ${
                      assetType === item.value ? "text-white" : "text-neutral-900"
                    }`}
                  >
                    {tDomain(`assetTypes.${item.value}`)}
                  </span>
                  <span
                    className={`mt-1 block text-xs font-medium uppercase tracking-wide ${
                      assetType === item.value ? "text-white/65" : "text-neutral-500"
                    }`}
                  >
                    {tDomain(`transactionKinds.${item.transactionType}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case STEPS.LOCATION:
        return (
          <div className="flex flex-col gap-6">
            <Heading
              title={t("locationTitle")}
              subtitle={t("locationSubtitle")}
            />
            <CountrySelect value={location} onChange={selectCountry} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="city"
                label={t("city")}
                disabled={isLoading}
                register={register}
                errors={errors}
                watch={watch}
                maxLength={120}
                required
              />
              <Input
                id="district"
                label={t("district")}
                disabled={isLoading}
                register={register}
                errors={errors}
                watch={watch}
                maxLength={120}
              />
            </div>
            <div>
              <Input
                id="addressDetails"
                label={t("addressDetails")}
                disabled={isLoading}
                register={register}
                errors={errors}
                watch={watch}
                maxLength={300}
              />
              <p className="mt-2 text-xs font-medium text-neutral-500">
                {t("addressHint")}
              </p>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-neutral-900">
                  {t("mapLabel")}
                </p>
                <button
                  type="button"
                  onClick={locateMe}
                  disabled={isLocating}
                  className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-black text-neutral-700 transition hover:bg-neutral-950 hover:text-white disabled:opacity-60"
                >
                  {isLocating ? t("locating") : t("useMyPosition")}
                </button>
              </div>
              <div className="h-[300px] overflow-hidden rounded-lg">
                <Map
                  center={mapFocus?.center ?? location?.latlng}
                  zoom={mapFocus?.zoom ?? (location ? 6 : 2)}
                  marker={coordinates}
                  onPick={(point) => setCustomValue("coordinates", point)}
                />
              </div>
              <p
                className={`mt-2 text-xs font-semibold ${
                  coordinates ? "text-emerald-700" : "text-neutral-500"
                }`}
              >
                {coordinates
                  ? t("pinPlaced")
                  : t("pinHint")}
              </p>
            </div>
          </div>
        );

      case STEPS.INFO:
        return (
          <div className="flex flex-col gap-6">
            <Heading
              title={t("infoTitle")}
              subtitle={assetType === "land_sale" ? t("infoSubtitleLand") : t("infoSubtitle")}
            />
            {assetType !== "land_sale" && transactionType === "booking" && (
              <>
                <Counter
                  title={t("guests")}
                  subtitle={t("guestsHint")}
                  watch={watch}
                  onChange={setCustomValue}
                  name="guestCount"
                />
                <hr />
              </>
            )}
            {assetType === "land_sale" ? (
              <>
                <Input
                  id="areaSqm"
                  label={t("landArea")}
                  type="number"
                  disabled={isLoading}
                  register={register}
                  errors={errors}
                  required
                  watch={watch}
                />
                <Input
                  id="landTitleStatus"
                  label={t("landTitleStatus")}
                  disabled={isLoading}
                  register={register}
                  errors={errors}
                  required
                  watch={watch}
                />
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        );

      case STEPS.IMAGES:
        return (
          <div className="flex flex-col gap-6">
            <Heading
              title={t("photosTitle")}
              subtitle={t("photosSubtitle")}
            />
            <ImageUpload
              onChange={setCustomValue}
              initialImages={getValues("images")}
              minImages={3}
            />
          </div>
        );

      case STEPS.DESCRIPTION:
        return (
          <div className="flex flex-col gap-6">
            <Heading
              title={t("descriptionTitle")}
              subtitle={t("descriptionSubtitle")}
            />
            <Input
              id="title"
              label={t("titleField")}
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
              autoFocus
            />
            <hr />
            <Input
              id="description"
              label={t("descriptionField")}
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
          </div>
        );

      case STEPS.PRICE:
        return (
          <div className="flex flex-col gap-6">
            <Heading
              title={t("priceTitle")}
              subtitle={
                transactionType === "booking"
                  ? t("priceSubtitleBooking")
                  : transactionType === "rent"
                  ? t("priceSubtitleRent")
                  : t("priceSubtitleSale")
              }
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              {t("currency")}
              <select
                {...register("currency", { required: true })}
                disabled={isLoading}
                className="h-[46px] rounded border border-neutral-300 bg-white px-4 text-[15px] outline-none transition focus:border-black"
              >
                {currencies.map((currency) => (
                  <option value={currency} key={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            <Input
              key={transactionType === "booking" ? "price" : transactionType === "rent" ? "monthlyRent" : "salePrice"}
              id={
                transactionType === "booking"
                  ? "price"
                  : transactionType === "rent"
                  ? "monthlyRent"
                  : "salePrice"
              }
              label={
                transactionType === "booking"
                  ? t("pricePerNight")
                  : transactionType === "rent"
                  ? t("monthlyRent")
                  : t("salePrice")
              }
              icon={BiDollar}
              type="number"
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
              autoFocus
            />
            {assetType !== "land_sale" && (
              <Input
                id="areaSqm"
                label={t("area")}
                type="number"
                disabled={isLoading}
                register={register}
                errors={errors}
                watch={watch}
              />
            )}
            <Input
              id="propertyCondition"
              label={t("condition")}
              disabled={isLoading}
              register={register}
              errors={errors}
              watch={watch}
            />
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "external", label: t("tourExternal") },
                  { value: "panorama", label: t("tourPanorama") },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCustomValue("virtualTourMode", item.value)}
                    className={`rounded-full px-4 py-2 text-sm font-black transition ${
                      virtualTourMode === item.value
                        ? "bg-neutral-950 text-white"
                        : "bg-white text-neutral-600 hover:text-neutral-950"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                {virtualTourMode === "panorama" ? (
                  <VirtualTourUpload
                    value={getValues("virtualTourPanoramas")}
                    onChange={setCustomValue}
                  />
                ) : (
                  <>
                    <Input
                      id="virtualTourUrl"
                      label={t("tourUrl")}
                      type="url"
                      disabled={isLoading}
                      register={register}
                      errors={errors}
                      watch={watch}
                    />
                    <p className="mt-3 text-xs font-medium leading-5 text-neutral-500">
                      {t("tourUrlHint")}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex flex-col gap-2">
            <Heading
              title={t("categoryTitle")}
              subtitle={t("categorySubtitle")}
            />
            <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1 scroll-smooth md:max-h-[46vh]">
              {categories.map((item) => (
                  <CategoryButton
                    onClick={setCustomValue}
                    watch={watch}
                    label={item.label}
                    icon={item.icon}
                    key={item.label}
                  />
              ))}
            </div>
          </div>
        );
    }
  };

  const priceField =
    transactionType === "booking"
      ? "price"
      : transactionType === "rent"
      ? "monthlyRent"
      : "salePrice";
  const uploadedImages = (getValues("images") ?? []) as string[];
  const isFieldFilled =
    step === STEPS.PRICE
      ? !!getValues(priceField)
      : step === STEPS.IMAGES
      ? uploadedImages.length >= 3
      : step === STEPS.CATEGORY && !usesLifestyleCategory
      ? true
      : step === STEPS.LOCATION
      ? Boolean(location && city.trim() && coordinates)
      : !!getValues(steps[step]);

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <Modal.WindowHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <form
        className="grid min-h-0 flex-1 bg-white outline-none focus:outline-none md:grid-cols-[300px_1fr]"
        onSubmit={handleSubmit(onSubmit)}
      >
        <aside className="hidden border-r border-neutral-200 bg-neutral-950 p-6 text-white md:block">
          <div className="sticky top-24">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-300">
              {t("asideKicker")}
            </p>
            <h2 className="mt-4 text-2xl font-black leading-tight">
              {t("asideTitle")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-300">
              {selectedAsset
                ? tDomain(`assetTypes.${selectedAsset.value}`)
                : t("selectAsset")}{" "}
              · {tDomain(`transactionKinds.${transactionType}`)}
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
                  key={item.label}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    index === currentStepIndex
                      ? "bg-white text-neutral-950"
                      : index < currentStepIndex
                      ? "bg-white/10 text-white"
                      : "text-neutral-400"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                      index === currentStepIndex
                        ? "bg-neutral-950 text-white"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="font-bold">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto p-5 md:p-8">
            <div className="mx-auto max-w-[620px] rounded-[24px] bg-white">
              {body()}
            </div>
          </div>
          <div className="sticky bottom-0 border-t border-neutral-200 bg-white/95 px-5 py-4 backdrop-blur md:px-8">
            <div className="mx-auto flex max-w-[620px] flex-row items-center gap-3">
              {currentStepIndex > 0 ? (
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
                disabled={isLoading || !isFieldFilled}
              >
                {isLoading ? (
                  <SpinnerMini />
                ) : step === STEPS.PRICE ? (
                  t("submit")
                ) : (
                  t("continue")
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default RentModal;
