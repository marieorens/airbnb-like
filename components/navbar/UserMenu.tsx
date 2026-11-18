"use client";
import React from "react";
import { AiOutlineMenu } from "react-icons/ai";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import Avatar from "../Avatar";
import MenuItem from "./MenuItem";
import Menu from "@/components/Menu";
import RentModal from "../modals/RentModal";
import Modal from "../modals/Modal";
import AuthModal from "../modals/AuthModal";
import { menuItems } from "@/utils/constants";
import { createClient } from "@/lib/supabase/browser";
import type { CurrentUser } from "@/types/listing";

interface UserMenuProps {
  user?: CurrentUser;
}

const UserMenu: React.FC<UserMenuProps> = ({ user }) => {
  const router = useRouter();
  const t = useTranslations("nav");
  // Publier exige un profil complet, puis un compte validé par la modération.
  const canPublish = Boolean(user?.isProfileComplete && user?.isVerified);
  const nextStep = !user?.isProfileComplete
    ? { label: t("completeProfile"), href: "/complete-profile?next=/verification" }
    : { label: t("verifyAccount"), href: "/verification" };

  const redirect = (url: string) => {
    router.push(url);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  return (
    <div className="relative">
      <div className="flex flex-row items-center gap-3">
        <Modal>
          {user ? (
            canPublish ? (
              <Modal.Trigger name="share">
                <button
                  type="button"
                  className="hidden md:block text-sm font-bold py-3 px-4 rounded-full hover:bg-neutral-100 transition cursor-pointer text-[#585858]"
                >
                  {t("publish")}
                </button>
              </Modal.Trigger>
            ) : (
              <button
                type="button"
                onClick={() => redirect(nextStep.href)}
                className="hidden md:block text-sm font-bold py-3 px-4 rounded-full hover:bg-neutral-100 transition cursor-pointer text-[#585858]"
              >
                {nextStep.label}
              </button>
            )
          ) : null}
          {!user ? (
            <div className="hidden items-center gap-3 md:flex">
              <Modal.Trigger name="Inscription">
                <button
                  type="button"
                  className="h-11 rounded-full border border-neutral-300 bg-white px-5 text-sm font-black text-neutral-950 transition hover:border-neutral-950"
                >
                  {t("signUp")}
                </button>
              </Modal.Trigger>
              <Modal.Trigger name="Connexion">
                <button
                  type="button"
                  className="h-11 rounded-full bg-[#E11D48] px-6 text-sm font-black text-white transition hover:bg-[#BE123C]"
                >
                  {t("signIn")}
                </button>
              </Modal.Trigger>
            </div>
          ) : null}
          <Menu>
            <Menu.Toggle id="user-menu">
              <button
                type="button"
                className={`flex cursor-pointer flex-row items-center gap-3 rounded-full border border-neutral-200 p-4 transition duration-300 hover:shadow-md md:py-1 md:px-2 ${
                  user ? "" : "md:hidden"
                }`}
              >
                <AiOutlineMenu />
                <div className="hidden md:block">
                  <Avatar src={user?.image} />
                </div>
              </button>
            </Menu.Toggle>
            <Menu.List className="shadow-[0_0_36px_4px_rgba(0,0,0,0.075)] rounded-xl bg-white text-sm">
              {user ? (
                <>
                  {menuItems.map((item) => (
                    <MenuItem
                      label={t(`menu.${item.key}`)}
                      onClick={() => redirect(item.path)}
                      key={item.key}
                    />
                  ))}

                  {canPublish ? (
                    <Modal.Trigger name="share">
                      <MenuItem label={t("publish")} />
                    </Modal.Trigger>
                  ) : (
                    <MenuItem label={nextStep.label} onClick={() => redirect(nextStep.href)} />
                  )}
                  <hr />
                  <MenuItem label={t("signOut")} onClick={handleSignOut} />
                </>
              ) : (
                <>
                  <Modal.Trigger name="Connexion">
                    <MenuItem label={t("signIn")} />
                  </Modal.Trigger>

                  <Modal.Trigger name="Inscription">
                    <MenuItem label={t("createAccount")} />
                  </Modal.Trigger>
                </>
              )}
            </Menu.List>
          </Menu>
          <Modal.Window name="Connexion">
            <AuthModal name="Connexion" />
          </Modal.Window>
          <Modal.Window name="Inscription">
            <AuthModal name="Inscription" />
          </Modal.Window>
          <Modal.Window name="share">
            <RentModal />
          </Modal.Window>
        </Modal>
      </div>
    </div>
  );
};

export default UserMenu;
