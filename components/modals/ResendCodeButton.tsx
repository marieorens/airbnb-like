"use client";
import { useEffect, useState } from "react";
import { HiCheckCircle } from "react-icons/hi2";
import { useTranslations } from "next-intl";

import SpinnerMini from "../Loader";

/** Supabase n'envoie qu'un email par minute à une même adresse. */
const COOLDOWN_MS = 60_000;

/**
 * « Renvoyer le code », avec un retour visible : indicateur pendant l'envoi,
 * puis « Code envoyé » et un compte à rebours avant le prochain envoi.
 * Même comportement que `components/resend-code-button.tsx` du mobile.
 */
const ResendCodeButton = ({
  onResend,
  pending,
  justSent,
}: {
  /** Lance l'envoi ; appelle `onSent` quand le code est parti. */
  onResend: (onSent: () => void) => void;
  pending: boolean;
  /** Un code vient de partir à l'ouverture de l'écran : le délai court déjà. */
  justSent?: boolean;
}) => {
  const t = useTranslations("auth");
  const [now, setNow] = useState(() => Date.now());
  const [cooldownUntil, setCooldownUntil] = useState(() =>
    justSent ? Date.now() + COOLDOWN_MS : 0
  );

  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const press = () =>
    onResend(() => {
      const sentAt = Date.now();
      setNow(sentAt);
      setCooldownUntil(sentAt + COOLDOWN_MS);
    });

  return (
    <button
      type="button"
      onClick={press}
      disabled={pending || remaining > 0}
      aria-live="polite"
      className="flex items-center gap-1.5 font-black text-neutral-950 enabled:hover:underline disabled:cursor-default"
    >
      {pending ? (
        <>
          <SpinnerMini className="h-4 w-4 text-neutral-500" />
          <span className="font-semibold text-neutral-500">{t("sending")}</span>
        </>
      ) : remaining > 0 ? (
        <>
          <HiCheckCircle className="text-rose-600" size={18} />
          <span className="font-semibold text-neutral-500">
            {t("codeResent", { seconds: remaining })}
          </span>
        </>
      ) : (
        t("resendCode")
      )}
    </button>
  );
};

export default ResendCodeButton;
