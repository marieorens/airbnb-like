"use client";
import React, { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
  const assetType = watch("assetType") || "short_stay";
  const virtualTourMode = watch("virtualTourMode") || "external";
  const selectedAsset = assetTypes.find((asset) => asset.value === assetType);
  const transactionType = selectedAsset?.transactionType ?? "booking";
  const usesLifestyleCategory = ["short_stay", "house_rent", "house_sale"].includes(
    assetType
  );
  const stepItems = [
    { step: STEPS.ASSET, label: "Type" },
    ...(usesLifestyleCategory
      ? [{ step: STEPS.CATEGORY, label: "Categorie" }]
      : []),
    { step: STEPS.LOCATION, label: "Adresse" },
    { step: STEPS.INFO, label: assetType === "land_sale" ? "Terrain" : "Details" },
    { step: STEPS.IMAGES, label: "Photos" },
    { step: STEPS.DESCRIPTION, label: "Description" },
    { step: STEPS.PRICE, label: "Prix" },
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
        toast.success(`${data.title} a ete envoye en verification.`);
        queryClient.invalidateQueries({
          queryKey: ["listings"],
        });
        reset();
        setStep(STEPS.ASSET);
        onCloseModal?.();
        router.refresh();
        router.push(`/listings/${newListing.id}`);
      } catch (error: any) {
        toast.error("Impossible de creer l'annonce.");
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
              title="Que voulez-vous publier ?"
              subtitle="Locations courtes, ventes, parcelles et biens pros sont acceptes."
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
                    {item.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs font-medium uppercase tracking-wide ${
                      assetType === item.value ? "text-white/65" : "text-neutral-500"
                    }`}
                  >
                    {item.transactionType === "booking"
                      ? "Reservation en ligne"
                      : item.transactionType === "rent"
                      ? "Location longue duree"
                      : item.transactionType === "sale"
                      ? "Vente immobiliere"
                      : "Demande de contact"}
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
              title="Ou se trouve le bien ?"
              subtitle="Aidez les acheteurs et voyageurs a le situer."
            />
            <CountrySelect value={location} onChange={setCustomValue} />
            <div className="h-[240px]">
              <Map center={location?.latlng} />
            </div>
          </div>
        );

      case STEPS.INFO:
        return (
          <div className="flex flex-col gap-6">
            <Heading
              title="Quelques infos utiles"
              subtitle={
                assetType === "land_sale"
                  ? "Pour une parcelle, la surface et les documents comptent plus que les pieces."
                  : "Ces infos restent utiles pour qualifier le bien."
              }
            />
            {assetType !== "land_sale" && transactionType === "booking" && (
              <>
                <Counter
                  title="Voyageurs"
                  subtitle="Combien de personnes peuvent etre accueillies ?"
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
                  label="Surface du terrain en m2"
                  type="number"
                  disabled={isLoading}
                  register={register}
                  errors={errors}
                  required
                  watch={watch}
                />
                <Input
                  id="landTitleStatus"
                  label="Statut des documents fonciers"
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
                  title="Pieces"
                  subtitle="Combien de pieces comporte le bien ?"
                  name="roomCount"
                />
                <hr />
                <Counter
                  onChange={setCustomValue}
                  watch={watch}
                  title="Salles de bain"
                  subtitle="Combien de salles de bain sont disponibles ?"
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
              title="Ajoutez au moins 3 photos"
              subtitle="Montrez la facade, l'interieur ou les limites du terrain."
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
              title="Decrivez le bien"
              subtitle="Soyez clair: localisation, etat, documents, atouts."
            />
            <Input
              id="title"
              label="Titre"
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
              label="Description"
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
              title="Prix et details"
              subtitle={
                transactionType === "booking"
                  ? "Combien facturez-vous par nuit ?"
                  : transactionType === "rent"
                  ? "Indiquez le loyer mensuel attendu."
                  : "Indiquez le prix de vente attendu."
              }
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              Devise
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
                  ? "Prix par nuit"
                  : transactionType === "rent"
                  ? "Loyer mensuel"
                  : "Prix de vente"
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
                label="Surface en m2"
                type="number"
                disabled={isLoading}
                register={register}
                errors={errors}
                watch={watch}
              />
            )}
            <Input
              id="propertyCondition"
              label="Etat du bien"
              disabled={isLoading}
              register={register}
              errors={errors}
              watch={watch}
            />
            <Input
              id="addressDetails"
              label="Details de l'adresse"
              disabled={isLoading}
              register={register}
              errors={errors}
              watch={watch}
            />
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "external", label: "Lien externe" },
                  { value: "panorama", label: "Image 360" },
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
                      label="Lien de visite virtuelle (optionnel)"
                      type="url"
                      disabled={isLoading}
                      register={register}
                      errors={errors}
                      watch={watch}
                    />
                    <p className="mt-3 text-xs font-medium leading-5 text-neutral-500">
                      Matterport, Kuula, CloudPano ou tout autre lien de visite
                      externe.
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
              title="Quelle categorie de bien ?"
              subtitle="Cette etape sert uniquement aux logements et maisons."
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
      : !!getValues(steps[step]);

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <Modal.WindowHeader
        title="Publier un bien"
        subtitle="Votre annonce partira en verification admin avant publication"
      />
      <form
        className="grid min-h-0 flex-1 bg-white outline-none focus:outline-none md:grid-cols-[300px_1fr]"
        onSubmit={handleSubmit(onSubmit)}
      >
        <aside className="hidden border-r border-neutral-200 bg-neutral-950 p-6 text-white md:block">
          <div className="sticky top-24">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-300">
              Nouvelle annonce
            </p>
            <h2 className="mt-4 text-2xl font-black leading-tight">
              Un parcours clair, puis moderation.
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-300">
              {selectedAsset?.label ?? "Selectionnez un type de bien"} ·{" "}
              {transactionType === "booking"
                ? "reservation"
                : transactionType === "rent"
                ? "location"
                : transactionType === "sale"
                ? "vente"
                : "contact"}
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
                  Retour
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
                  "Envoyer en verification"
                ) : (
                  "Continuer"
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
