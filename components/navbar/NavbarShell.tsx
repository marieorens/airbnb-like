"use client";

import React, { useEffect, useState } from "react";
import { MdDarkMode, MdLightMode } from "react-icons/md";

import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/utils/helper";

interface NavbarShellProps {
  logo: React.ReactNode;
  search: React.ReactNode;
  userMenu: React.ReactNode;
  categories: React.ReactNode;
}

const NavbarShell: React.FC<NavbarShellProps> = ({
  logo,
  search,
  userMenu,
  categories,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed left-0 top-0 z-20 w-full transition-all duration-300",
        isScrolled ? "px-3 pt-2 sm:px-5 lg:px-8" : "bg-white"
      )}
    >
      <nav
        className={cn(
          "transition-all duration-300",
          isScrolled
            ? "rounded-full border border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl"
            : "border-b border-neutral-200 bg-white"
        )}
      >
        <div
          className={cn(
            "mx-auto flex min-h-[72px] w-full flex-row items-center justify-between gap-3 px-4 transition-all duration-300 sm:px-6",
            isScrolled ? "max-w-[calc(100vw-24px)] lg:px-8" : "main-container"
          )}
        >
          {logo}


          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden md:block">{search}</div>
            <button
              type="button"
              aria-label="Changer le theme"
              aria-pressed={isDark}
              onClick={toggleTheme}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition sm:h-11 sm:w-11",
                isDark
                  ? "bg-neutral-950 text-white hover:bg-neutral-800"
                  : "bg-neutral-100 text-neutral-950 hover:bg-neutral-200"
              )}
            >
              {isDark ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
            </button>
            {userMenu}
          </div>
        </div>
      </nav>
      {categories}
    </header>
  );
};

export default NavbarShell;
