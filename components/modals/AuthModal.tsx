"use client";
import React, { useTransition, useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { HiOutlineShieldCheck, HiOutlineSparkles } from "react-icons/hi2";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import Heading from "../Heading";
import Input from "../inputs/Input";
import Button from "../Button";
import Modal from "./Modal";
import SpinnerMini from "../Loader";
import { createClient } from "@/lib/supabase/browser";

const AuthModal = ({
  name,
  onCloseModal,
}: {
  name?: string;
  onCloseModal?: () => void;
}) => {
  const t = useTranslations("auth");
  const [isLoading, startTransition] = useTransition();
  // « Connexion » / « Inscription » : identifiants de mode, pas des libellés affichés.
  const [title, setTitle] = useState(name || "");
  // Adresse en attente de confirmation : affiche la saisie du code à 6 chiffres.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isVerifying, startVerifying] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setError,
    setFocus,
  } = useForm<FieldValues>({
    defaultValues: {
      email: "",
      password: "",
        name: "",
        phone: "",
        countryOfResidence: "",
        accountPurpose: "buyer",
        accountType: "individual",
        companyName: "",
      },
  });
  const router = useRouter();
  const isLoginModal = title === "Connexion";
  const accountType = watch("accountType") as "individual" | "agency";

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoginModal) {
        setFocus("email");
      } else {
        setFocus("name");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isLoginModal, setFocus]);

  const onToggle = () => {
    const newTitle = isLoginModal ? "Inscription" : "Connexion";
    setTitle(newTitle);
    reset();
  };

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
      const {
        email,
        password,
        name,
        phone,
        countryOfResidence,
        accountPurpose,
        accountType: type,
        companyName,
      } = data;
    const supabase = createClient();

    startTransition(async () => {
      try {
        if (isLoginModal) {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          toast.success(t("signedIn"));
          onCloseModal?.();
          router.refresh();
        } else {
          const { data: signUpData, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
                phone,
                country_of_residence: countryOfResidence,
                account_purpose: [accountPurpose],
                account_type: type === "agency" ? "agency" : "individual",
                company_name: type === "agency" ? String(companyName ?? "").trim() : null,
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

          if (error) throw error;

          // Confirmation d'email désactivée : la session est déjà ouverte.
          if (signUpData.session) {
            toast.success(t("signedUp"));
            reset();
            onCloseModal?.();
            router.push("/complete-profile");
            return;
          }

          // Email déjà utilisé : Supabase renvoie un utilisateur sans identité.
          if (signUpData.user && signUpData.user.identities?.length === 0) {
            throw { code: "user_already_exists" };
          }

          toast.success(t("codeSent"));
          setPendingEmail(String(email).trim());
          setCode("");
        }
      } catch (error: any) {
        // Supabase renvoie des messages en anglais : on traduit à partir du code d'erreur.
        const errorCode = typeof error?.code === "string" ? error.code : "";
        // Compte créé mais jamais confirmé : on renvoie un code et on propose de le saisir.
        if (isLoginModal && errorCode === "email_not_confirmed") {
          await supabase.auth.resend({ type: "signup", email: String(email).trim() });
          toast(t("confirmFirst"));
          setPendingEmail(String(email).trim());
          setCode("");
          return;
        }
        toast.error(
          t.has(`errors.${errorCode}`) ? t(`errors.${errorCode}`) : t("errors.generic")
        );
        if (isLoginModal) {
          reset();
          setError("email", {});
          setError("password", {});
          setTimeout(() => {
            setFocus("email");
          }, 100)
        }
      }
    });
  };

  const verifyCode = () => {
    if (!pendingEmail || !/^\d{6}$/.test(code)) {
      toast.error(t("codeInvalid"));
      return;
    }
    const supabase = createClient();
    startVerifying(async () => {
      const { error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: code,
        type: "email",
      });
      if (error) {
        const errorCode = typeof error.code === "string" ? error.code : "";
        toast.error(
          t.has(`errors.${errorCode}`) ? t(`errors.${errorCode}`) : t("codeInvalid")
        );
        return;
      }
      toast.success(t("emailVerified"));
      reset();
      setPendingEmail(null);
      onCloseModal?.();
      // Étape suivante du parcours : compléter le profil, puis la vérification.
      router.push("/complete-profile");
      router.refresh();
    });
  };

  const resendCode = () => {
    if (!pendingEmail) return;
    const supabase = createClient();
    startVerifying(async () => {
      const { error } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
      if (error) {
        const errorCode = typeof error.code === "string" ? error.code : "";
        toast.error(
          t.has(`errors.${errorCode}`) ? t(`errors.${errorCode}`) : t("errors.generic")
        );
        return;
      }
      toast.success(t("codeSent"));
    });
  };

  if (pendingEmail) {
    return (
      <div className="flex h-full w-full flex-col bg-white">
        <Modal.WindowHeader title={t("verifyTitle")} subtitle={t("subtitle")} />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6 md:p-8">
          <Heading
            title={t("verifyHeading")}
            subtitle={t("verifyIntro", { email: pendingEmail })}
          />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(event) => {
              if (event.key === "Enter") verifyCode();
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            aria-label={t("codeLabel")}
            placeholder="••••••"
            className="h-14 w-full rounded-xl border border-neutral-300 text-center text-2xl font-black tracking-[0.5em] text-neutral-950 outline-none transition focus:border-neutral-950"
          />
          <Button
            type="button"
            onClick={verifyCode}
            disabled={isVerifying || code.length !== 6}
            className="flex h-12 items-center justify-center rounded-xl bg-neutral-950 text-sm font-black hover:bg-neutral-800"
          >
            {isVerifying ? <SpinnerMini className="w-5 h-5" /> : t("verify")}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={resendCode}
              disabled={isVerifying}
              className="font-black text-neutral-950 hover:underline disabled:opacity-60"
            >
              {t("resendCode")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingEmail(null);
                setTitle("Connexion");
              }}
              className="font-semibold text-neutral-500 hover:underline"
            >
              {t("changeEmail")}
            </button>
          </div>
          <p className="text-xs font-medium leading-5 text-neutral-500">{t("codeHint")}</p>
        </div>
      </div>
    );
  }

  const signInWithGoogle = async () => {
    window.location.href = "/auth/google";
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <Modal.WindowHeader
        title={isLoginModal ? t("signInTitle") : t("signUpTitle")}
        subtitle={t("subtitle")}
      />

      <form
        className="grid flex-1 overflow-y-auto md:grid-cols-[0.85fr_1.15fr]"
        onSubmit={handleSubmit(onSubmit)}
      >
        <aside className="relative hidden min-h-[560px] overflow-hidden bg-neutral-950 p-8 text-white md:flex md:flex-col md:justify-between">
          <div className="absolute inset-0 opacity-70">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[length:34px_34px]" />
            <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(244,63,94,0.22),transparent_42%,rgba(14,165,233,0.18))]" />
          </div>
          <div className="relative">
            <h2 className="mt-6 text-3xl font-black leading-tight">
              {t("asideTitle")}
            </h2>
            <p className="mt-4 text-sm leading-6 text-neutral-300">
              {t("asideText")}
            </p>
          </div>
          <div className="relative grid gap-3 text-sm">
            {[t("asidePoint1"), t("asidePoint2"), t("asidePoint3")].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"
              >
                <HiOutlineShieldCheck className="text-emerald-300" size={18} />
                <span className="text-neutral-100">{item}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex flex-col gap-5 p-6 md:p-8">
          <Heading
            title={!isLoginModal ? t("welcome") : t("welcomeBack")}
            subtitle={!isLoginModal ? t("signUpIntro") : t("signInIntro")}
          />

          {!isLoginModal && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium text-neutral-700">
                {t("accountType")}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["individual", "agency"] as const).map((type) => (
                  <label
                    key={type}
                    className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition ${
                      accountType === type
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-500"
                    }`}
                  >
                    <input
                      type="radio"
                      value={type}
                      disabled={isLoading}
                      {...register("accountType")}
                      className="sr-only"
                    />
                    <span className="text-sm font-black">{t(`accountTypes.${type}`)}</span>
                    <span
                      className={`text-xs font-medium leading-5 ${
                        accountType === type ? "text-neutral-300" : "text-neutral-500"
                      }`}
                    >
                      {t(`accountTypeHints.${type}`)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {!isLoginModal && accountType === "agency" && (
            <Input
              id="companyName"
              label={t("companyName")}
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
          )}

          {!isLoginModal && (
            <div className="grid gap-4 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
            <Input
              id="name"
              label={t("fullName")}
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
            <Input
              id="phone"
              label={t("phone")}
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
            <Input
              id="countryOfResidence"
              label={t("countryOfResidence")}
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              {t("accountPurpose")}
              <select
                disabled={isLoading}
                {...register("accountPurpose", { required: true })}
                className="h-[46px] rounded border border-neutral-300 bg-white px-4 text-[15px] outline-none transition focus:border-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                {(["buyer", "seller", "renter", "host", "investor", "other"] as const).map(
                  (purpose) => (
                    <option key={purpose} value={purpose}>
                      {t(`purposes.${purpose}`)}
                    </option>
                  )
                )}
              </select>
            </label>
            </div>
          )}

          <div className="grid gap-4">
            <Input
              id="email"
              label={t("email")}
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />

            <Input
              id="password"
              label={t("password")}
              type="password"
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
          </div>

          <Button
            type="submit"
            className="flex h-12 items-center justify-center rounded-xl bg-neutral-950 text-sm font-black hover:bg-neutral-800"
          >
            {isLoading ? <SpinnerMini className="w-5 h-5" /> : t("continue")}
          </Button>

          <div className="relative flex items-center py-1">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="px-4 text-xs font-bold uppercase tracking-wide text-neutral-400">
              {t("or")}
            </span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <Button
            outline
            type="button"
            onClick={signInWithGoogle}
            className="flex h-12 flex-row items-center justify-center gap-2 rounded-xl border-neutral-300 px-3 py-2 font-bold"
          >
            <FcGoogle className="w-6 h-6" />
            <span className="text-[14px]">{t("google")}</span>
          </Button>

          <div className="rounded-2xl bg-neutral-50 p-4 text-center text-sm font-medium text-neutral-500 ring-1 ring-neutral-200">
            <span>
              {!isLoginModal ? t("hasAccount") : t("firstVisit")}
            </span>
            <button
              type="button"
              onClick={onToggle}
              className="ml-1 cursor-pointer font-black text-neutral-950 hover:underline"
            >
              {!isLoginModal ? t("switchToSignIn") : t("switchToSignUp")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AuthModal;
