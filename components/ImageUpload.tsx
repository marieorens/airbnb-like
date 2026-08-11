import React, { ChangeEvent, FC, useState, useTransition } from "react";
import Image from "next/image";
import { TbPhotoPlus } from "react-icons/tb";
import toast from "react-hot-toast";

import SpinnerMini from "./Loader";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/utils/helper";

interface ImageUploadProps {
  onChange: (fieldName: string, value: string | string[]) => void;
  initialImage?: string;
  initialImages?: string[];
  minImages?: number;
}

const ImageUpload: FC<ImageUploadProps> = ({
  onChange,
  initialImage = "",
  initialImages,
  minImages = 3,
}) => {
  const [images, setImages] = useState<string[]>(
    initialImages?.length ? initialImages : initialImage ? [initialImage] : []
  );
  const [isLoading, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  const syncImages = (nextImages: string[]) => {
    setImages(nextImages);
    onChange("images", nextImages);
    onChange("image", nextImages[0] ?? "");
  };

  const uploadImages = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image")
    );

    if (imageFiles.length === 0) return;

    const optimisticImages = [
      ...images,
      ...imageFiles.map((file) => URL.createObjectURL(file)),
    ];
    setImages(optimisticImages);

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please sign in to upload images.");
        setImages(images);
        return;
      }

      const uploadedUrls: string[] = [];

      for (const file of imageFiles) {
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
        const storagePath = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${safeFileName}`;
        const { error } = await supabase.storage
          .from("listing-photos")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          toast.error(error.message);
          setImages(images);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("listing-photos").getPublicUrl(storagePath);

        uploadedUrls.push(publicUrl);
      }

      syncImages([...images, ...uploadedUrls]);
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    uploadImages(e.target.files);
    e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(false)
    uploadImages(e.dataTransfer.files)
  }

  const removeImage = (image: string) => {
    syncImages(images.filter((item) => item !== image));
  };

  const remaining = Math.max(minImages - images.length, 0);

  return (
    <div className="space-y-4">
      <label
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        htmlFor="hotel"
        className={cn(
          "relative flex h-[220px] w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-600 transition hover:border-neutral-950 hover:bg-white",
          isLoading && "opacity-70",
          isDragging && "border-rose-500 bg-rose-50"
        )}
      >
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-white/70">
            <SpinnerMini className="h-8 w-8 text-rose-600" />
          </div>
        )}
        <TbPhotoPlus className="mb-4 h-14 w-14" />
        <span className="text-lg font-black text-neutral-900">
          Ajouter des photos
        </span>
        <span className="mt-2 max-w-[320px] text-sm font-medium text-neutral-500">
          Minimum {minImages} photos. Vous pouvez en selectionner plusieurs a
          la fois.
        </span>
        <input
          type="file"
          accept="image/*"
          id="hotel"
          className="h-0 w-0 opacity-0"
          onChange={handleChange}
          multiple
          autoFocus
        />
      </label>

      <div className="flex items-center justify-between rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-bold text-white">
        <span>{images.length} photo{images.length > 1 ? "s" : ""} ajoutée{images.length > 1 ? "s" : ""}</span>
        <span className={remaining ? "text-rose-200" : "text-emerald-200"}>
          {remaining ? `${remaining} encore requise${remaining > 1 ? "s" : ""}` :""}
        </span>
      </div>

      {images.length > 0 && (
        <div className="grid max-h-[320px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={`${image}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-neutral-100"
            >
              <Image
                fill
                style={{ objectFit: "cover" }}
                src={image}
                alt={`Photo ${index + 1}`}
                sizes="160px"
                unoptimized
              />
              <button
                type="button"
                onClick={() => removeImage(image)}
                className="absolute right-2 top-2 rounded-full bg-neutral-950/80 px-2 py-1 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100"
              >
                Retirer
              </button>
              {index === 0 && (
                <span className="absolute bottom-2 left-2 rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-neutral-950">
                  Couverture
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
