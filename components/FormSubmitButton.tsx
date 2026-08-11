"use client";

import { useFormStatus } from "react-dom";

import SpinnerMini from "./Loader";

type FormSubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
};

export default function FormSubmitButton({
  children,
  pendingLabel = "Enregistrement...",
  className = "",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-rose-500 px-5 text-sm font-bold text-white transition hover:bg-rose-600 disabled:cursor-wait disabled:opacity-70 ${className}`}
    >
      {pending ? (
        <>
          <SpinnerMini className="h-4 w-4" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
