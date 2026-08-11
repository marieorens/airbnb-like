import React from "react";
import { IoMdClose } from "react-icons/io";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import Button from "./Button";
import SpinnerMini from "./Loader";

interface ConfirmDeleteProps {
  title: string;
  onConfirm: (fn?: () => void) => void;
  onCloseModal?: () => void;
  isLoading?: boolean;
}

const ConfirmDelete: React.FC<ConfirmDeleteProps> = ({
  title,
  onConfirm,
  onCloseModal,
  isLoading = false,
}) => {
  const onAction = () => {
    onConfirm(onCloseModal);
  };

  return (
    <div className="relative flex flex-col gap-5 bg-white px-6 py-7 md:px-8">
      <button
        type="button"
        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 transition hover:bg-neutral-950 hover:text-white"
        onClick={() => onCloseModal?.()}
        aria-label="Fermer"
      >
        <IoMdClose size={18} />
      </button>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <HiOutlineExclamationTriangle size={26} />
      </div>
      <div className="pr-10">
        <h1 className="text-[22px] font-black leading-tight text-neutral-950">
          {title}
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-neutral-600">
          Cette action est definitive. Verifiez bien avant de confirmer.
        </p>
      </div>

      <div className="mt-1 flex h-11 items-center gap-3">
        <Button
          onClick={() => onCloseModal?.()}
          className="h-full rounded-xl"
          outline
        >
          Annuler
        </Button>
        <Button
          onClick={onAction}
          className="flex h-full items-center justify-center rounded-xl bg-neutral-950 font-bold hover:bg-neutral-800"
        >
          {isLoading ? <SpinnerMini /> : <span>Confirmer</span>}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmDelete;
