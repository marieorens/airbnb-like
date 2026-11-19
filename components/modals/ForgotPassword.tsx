"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/browser";

import Button from "../Button";
import Heading from "../Heading";
import SpinnerMini from "../Loader";
import Modal from "./Modal";
import ResendCodeButton from "./ResendCodeButton";

const CODE_LENGTH = 6;
const MIN_PASSWORD_LENGTH = 6;

const fieldClass =
  "h-[46px] w-full rounded border border-neutral-300 bg-white px-4 text-[15px] outline-none transition focus:border-black disabled:cursor-not-allowed disabled:opacity-70";

/**
 * Mot de passe oublié, affiché dans la fenêtre de connexion.
 *
 * Même principe que la confirmation d'inscription : Supabase envoie un code à
 * 6 chiffres (modèle « Reset password »), qui ouvre une session ; on enregistre
 * alors le nouveau mot de passe. Pas de lien : il ouvrirait le site même quand
 * la demande vient de l'application mobile.
 */
const ForgotPassword = ({
  initialEmail,
  onBack,
  onDone,
}: {
  initialEmail: string;
  onBack: () => void;
  onDone: () => void;
}) => {
  const t = useTranslations("auth");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isResending, startResending] = useTransition();
  const [email, setEmail] = useState(initialEmail);
  // Adresse à laquelle le code a été envoyé : passe à la seconde étape.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const showError = (error: { code?: string } | null, fallback = "errors.generic") => {
    const errorCode = typeof error?.code === "string" ? error.code : "";
    toast.error(t.has(`errors.${errorCode}`) ? t(`errors.${errorCode}`) : t(fallback));
  };

  /** Envoie le code ; `true` s'il est parti. */
  const requestCode = async (address: string) => {
    // Réponse identique que l'adresse ait un compte ou non (pas d'énumération).
    const { error } = await createClient().auth.resetPasswordForEmail(address);
    if (error) showError(error);
    return !error;
  };

  const sendCode = (address: string) => {
    if (!address) return;
    startTransition(async () => {
      if (await requestCode(address)) setSentTo(address);
    });
  };

  const resendCode = (onSent: () => void) => {
    if (!sentTo) return;
    startResending(async () => {
      if (await requestCode(sentTo)) onSent();
    });
  };

  const submit = () => {
    if (!sentTo || code.length !== CODE_LENGTH) {
      toast.error(t("codeInvalid"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(t("errors.weak_password"));
      return;
    }
    const supabase = createClient();
    startTransition(async () => {
      // Le code ne sert qu'une fois : après un mot de passe refusé, la session
      // est déjà ouverte et on ne le revérifie pas.
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.email?.toLowerCase() !== sentTo.toLowerCase()) {
        const { error } = await supabase.auth.verifyOtp({
          email: sentTo,
          token: code,
          type: "recovery",
        });
        if (error) {
          showError(error, "codeInvalid");
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        showError(error);
        return;
      }
      toast.success(t("passwordChanged"));
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <Modal.WindowHeader title={t("forgotTitle")} subtitle={t("subtitle")} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6 md:p-8">
        <Heading
          title={sentTo ? t("resetHeading") : t("forgotHeading")}
          subtitle={sentTo ? t("resetIntro", { email: sentTo }) : t("forgotIntro")}
        />

        {!sentTo ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              sendCode(email.trim());
            }}
          >
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              {t("email")}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoFocus
                required
                disabled={isPending}
                className={fieldClass}
              />
            </label>
            <Button
              type="submit"
              disabled={isPending || !email.trim()}
              className="flex h-12 items-center justify-center rounded-xl bg-neutral-950 text-sm font-black hover:bg-neutral-800"
            >
              {isPending ? <SpinnerMini className="h-5 w-5" /> : t("sendCode")}
            </Button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-label={t("resetCodeLabel")}
              placeholder="••••••"
              className="h-14 w-full rounded-xl border border-neutral-300 text-center text-2xl font-black tracking-[0.5em] text-neutral-950 outline-none transition focus:border-neutral-950"
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              {t("newPassword")}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                disabled={isPending}
                className={fieldClass}
              />
            </label>
            <Button
              type="submit"
              disabled={isPending || code.length !== CODE_LENGTH || !password}
              className="flex h-12 items-center justify-center rounded-xl bg-neutral-950 text-sm font-black hover:bg-neutral-800"
            >
              {isPending ? <SpinnerMini className="h-5 w-5" /> : t("resetSubmit")}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <ResendCodeButton justSent pending={isResending} onResend={resendCode} />
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setCode("");
                  setPassword("");
                }}
                className="font-semibold text-neutral-500 hover:underline"
              >
                {t("changeEmail")}
              </button>
            </div>
          </form>
        )}

        <p className="text-xs font-medium leading-5 text-neutral-500">{t("codeHint")}</p>
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm font-black text-neutral-950 hover:underline"
        >
          {t("backToSignIn")}
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;
