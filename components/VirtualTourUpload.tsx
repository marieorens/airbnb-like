"use client";

import React, { ChangeEvent, FC, useState, useTransition } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { FiTrash2 } from "react-icons/fi";
import { TbView360 } from "react-icons/tb";

import SpinnerMini from "./Loader";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/utils/helper";

export type PanoramaInput = {
  url: string;
  label: string;
};

interface VirtualTourUploadProps {
  value?: PanoramaInput[];
  onChange: (fieldName: string, value: PanoramaInput[]) => void;
}

const defaultRoomLabels = [
  "Salon",
  "Chambre",
  "Cuisine",
  "Salle de bain",
  "Terrasse",
  "Exterieur",
];

const VirtualTourUpload: FC<VirtualTourUploadProps> = ({
  value = [],
  onChange,
}) => {
  const [panoramas, setPanoramas] = useState<PanoramaInput[]>(value);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, startTransition] = useTransition();

  const syncPanoramas = (nextPanoramas: PanoramaInput[]) => {
    setPanoramas(nextPanoramas);
    onChange("virtualTourPanoramas", nextPanoramas);
  };

  const uploadImages = (files?: FileList | File[]) => {
    if (!files) return;

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (!imageFiles.length) {
      toast.error("Veuillez choisir des images panoramiques.");
      return;
    }

    const optimisticPanoramas = [
      ...panoramas,
      ...imageFiles.map((file, index) => ({
        url: URL.createObjectURL(file),
        label:
          defaultRoomLabels[panoramas.length + index] ??
          `Piece ${panoramas.length + index + 1}`,
      })),
    ];
    setPanoramas(optimisticPanoramas);

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Connectez-vous pour ajouter une visite 360.");
        setPanoramas(panoramas);
        return;
      }

      const uploadedPanoramas: PanoramaInput[] = [];

      for (let index = 0; index < imageFiles.length; index += 1) {
        const file = imageFiles[index];
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
        const storagePath = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${safeFileName}`;

        const { error } = await supabase.storage
          .from("listing-virtual-tours")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          toast.error(error.message);
          setPanoramas(panoramas);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage
          .from("listing-virtual-tours")
          .getPublicUrl(storagePath);

        uploadedPanoramas.push({
          url: publicUrl,
          label:
            defaultRoomLabels[panoramas.length + index] ??
            `Piece ${panoramas.length + index + 1}`,
        });
      }

      syncPanoramas([...panoramas, ...uploadedPanoramas]);
      toast.success(
        `${uploadedPanoramas.length} panorama${
          uploadedPanoramas.length > 1 ? "s" : ""
        } ajoute${uploadedPanoramas.length > 1 ? "s" : ""}.`
      );
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    uploadImages(e.target.files ?? undefined);
    e.target.value = "";
  };

  const updateLabel = (index: number, label: string) => {
    syncPanoramas(
      panoramas.map((panorama, itemIndex) =>
        itemIndex === index ? { ...panorama, label } : panorama
      )
    );
  };

  const removePanorama = (index: number) => {
    syncPanoramas(panoramas.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-4">
      <label
        htmlFor="virtual-tour-panoramas"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          uploadImages(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-neutral-300 bg-white p-6 text-center transition hover:border-neutral-950",
          isDragging && "border-rose-500 bg-rose-50",
          isLoading && "opacity-80"
        )}
      >
        <TbView360 className="mb-4 h-14 w-14 text-neutral-800" />
        <span className="text-lg font-black text-neutral-950">
          Ajouter des panoramas 360
        </span>
        <span className="mt-2 max-w-[390px] text-sm font-medium leading-6 text-neutral-500">
          Ajoutez plusieurs images equirectangulaires, puis nommez chaque point:
          salon, chambre, cuisine, terrasse...
        </span>

        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75">
            <SpinnerMini className="h-8 w-8 text-rose-600" />
          </div>
        )}

        <input
          id="virtual-tour-panoramas"
          type="file"
          accept="image/*"
          className="h-0 w-0 opacity-0"
          onChange={handleChange}
          multiple
        />
      </label>

      {panoramas.length ? (
        <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
          {panoramas.map((panorama, index) => (
            <div
              key={`${panorama.url}-${index}`}
              className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:grid-cols-[120px_1fr_auto]"
            >
              <div className="relative h-24 overflow-hidden rounded-xl bg-neutral-100">
                <Image
                  src={panorama.url}
                  alt={`Panorama ${index + 1}`}
                  fill
                  sizes="120px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <label className="flex flex-col justify-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-500">
                Nom du point
                <input
                  value={panorama.label}
                  onChange={(event) => updateLabel(index, event.target.value)}
                  className="h-11 rounded-xl border border-neutral-200 px-3 text-sm font-bold normal-case tracking-normal text-neutral-950 outline-none transition focus:border-neutral-950"
                  placeholder={`Piece ${index + 1}`}
                />
              </label>
              <button
                type="button"
                onClick={() => removePanorama(index)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 sm:self-center"
                aria-label="Retirer ce panorama"
              >
                <FiTrash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default VirtualTourUpload;
