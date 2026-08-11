"use client";
import React, { useTransition, useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { HiOutlineShieldCheck, HiOutlineSparkles } from "react-icons/hi2";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

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
  const [isLoading, startTransition] = useTransition();
  const [title, setTitle] = useState(name || "");
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
      },
  });
  const router = useRouter();
  const isLoginModal = title === "Connexion";

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
      const { email, password, name, phone, countryOfResidence, accountPurpose } = data;
    const supabase = createClient();

    startTransition(async () => {
      try {
        if (isLoginModal) {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          toast.success("Connexion reussie.");
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
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

          if (error) throw error;

          toast.success("Compte cree avec succes.");
          reset();
          onCloseModal?.();
          if (signUpData.session) {
            router.push("/complete-profile");
          } else {
            setTitle("Connexion");
          }
        }
      } catch (error: any) {
        toast.error(error.message);
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

  const signInWithGoogle = async () => {
    window.location.href = "/auth/google";
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <Modal.WindowHeader
        title={isLoginModal ? "Connexion" : "Creer votre compte"}
        subtitle="Accedez aux reservations, ventes, locations et parcelles"
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
              Un compte pour louer, vendre, acheter et investir.
            </h2>
            <p className="mt-4 text-sm leading-6 text-neutral-300">
              VacationHub devient un vrai espace immobilier pour la diaspora et
              les proprietaires locaux, avec moderation admin avant publication.
            </p>
          </div>
          <div className="relative grid gap-3 text-sm">
            {[
              "Profil complet obligatoire avant publication",
              "Annonces verifiees par le backoffice",
              "Google ou email, meme base Supabase",
            ].map((item) => (
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
            title={!isLoginModal ? "Bienvenue sur VacationHub" : "Bon retour"}
            subtitle={
              title === "Inscription"
                ? "Dites-nous qui vous etes pour commencer."
                : "Connectez-vous pour continuer."
            }
          />

          {!isLoginModal && (
            <div className="grid gap-4 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
            <Input
              id="name"
              label="Nom complet"
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
            <Input
              id="phone"
              label="Telephone"
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
            <Input
              id="countryOfResidence"
              label="Pays de residence"
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              Objectif du compte
              <select
                disabled={isLoading}
                {...register("accountPurpose", { required: true })}
                className="h-[46px] rounded border border-neutral-300 bg-white px-4 text-[15px] outline-none transition focus:border-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="buyer">Acheter un bien</option>
                <option value="seller">Vendre un bien</option>
                <option value="renter">Louer un bien</option>
                <option value="host">Proposer un logement court sejour</option>
                <option value="investor">Investir depuis la diaspora</option>
                <option value="other">Autre</option>
              </select>
            </label>
            </div>
          )}

          <div className="grid gap-4">
            <Input
              id="email"
              label="Email"
              disabled={isLoading}
              register={register}
              errors={errors}
              required
              watch={watch}
            />

            <Input
              id="password"
              label="Mot de passe"
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
            {isLoading ? <SpinnerMini className="w-5 h-5" /> : "Continuer"}
          </Button>

          <div className="relative flex items-center py-1">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="px-4 text-xs font-bold uppercase tracking-wide text-neutral-400">
              ou
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
            <span className="text-[14px]">Continuer avec Google</span>
          </Button>

          <div className="rounded-2xl bg-neutral-50 p-4 text-center text-sm font-medium text-neutral-500 ring-1 ring-neutral-200">
            <span>
              {!isLoginModal
                ? "Vous avez deja un compte ?"
                : "Premiere visite sur VacationHub ?"}
            </span>
            <button
              type="button"
              onClick={onToggle}
              className="ml-1 cursor-pointer font-black text-neutral-950 hover:underline"
            >
              {!isLoginModal ? "Se connecter" : "Creer un compte"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AuthModal;
