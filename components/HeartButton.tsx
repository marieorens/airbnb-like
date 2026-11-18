"use client";
import React, { useState, useCallback, useRef } from "react";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { toast } from "react-hot-toast";
import { useMutation } from "@tanstack/react-query";
import debounce from "lodash.debounce";
import { useTranslations } from "next-intl";

import { cn } from "@/utils/helper";
import { updateFavorite } from "@/services/favorite-actions";

interface HeartButtonProps {
  listingId: string;
  hasFavorited: boolean;
}

const HeartButton: React.FC<HeartButtonProps> = ({
  listingId,
  hasFavorited: initialValue,
}) => {
  const t = useTranslations("favorites");
  const [hasFavorited, setHasFavorited] = useState(initialValue);
  const hasFavoritedRef = useRef(initialValue);
  const { mutate } = useMutation({
    mutationFn: updateFavorite,
    onError: () => {
      hasFavoritedRef.current = !hasFavoritedRef.current;
      setHasFavorited(hasFavoritedRef.current);
            // Le message d'une action serveur est masqué en production : on affiche le nôtre.
      toast.error(t("toggleError"));
    }
  });

  const debouncedUpdateFavorite = debounce(() => {
    mutate({
      listingId,
      favorite: hasFavoritedRef.current,
    });
  }, 300);

  const handleUpdate = useCallback(() => {
    debouncedUpdateFavorite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();

    handleUpdate();
    setHasFavorited((prev) => !prev);
    hasFavoritedRef.current = !hasFavoritedRef.current;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={hasFavorited ? t("remove") : t("add")}
      aria-pressed={hasFavorited}
      className=" relative hover:opacity-80 transition cursor-pointer z-[5] "
    >
      <AiOutlineHeart
        size={28}
        className="
          text-gray-50
          absolute
          -top-[2px]
          -right-[2px]
        "
      />
      <AiFillHeart
        size={24}
        className={cn(hasFavorited ? "fill-rose-500" : "fill-neutral-500/70")}
      />
    </button>
  );
};

export default HeartButton;
