"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Swiper, SwiperSlide } from "swiper/react";
import throttle from "lodash.throttle";
import "swiper/css";

import CategoryBox from "./CategoryBox";
import { categories } from "@/utils/constants";
import { Category } from "@/types";

const Categories = () => {
  const [isActive, setIsActive] = useState(false);
  const params = useSearchParams();
  const pathname = usePathname();
  const category = params?.get("category");
  const assetType = params?.get("assetType");
  const canUseLifestyleCategories =
    !assetType || ["short_stay", "house_rent", "house_sale"].includes(assetType);

  const isMainPage = pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsActive(true);
      } else {
        setIsActive(false);
      }
    };

    const throttledHandleScroll = throttle(handleScroll, 150);
    window.addEventListener("scroll", throttledHandleScroll);

    return () => window.removeEventListener("scroll", throttledHandleScroll);
  }, []);

  if (!isMainPage || !canUseLifestyleCategories) {
    return null;
  }

  return (
    <div
      className={`bg-white ${
        isActive ? "shadow-md shadow-[rgba(0,0,0,.045)]" : ""
      } transition-all duration-150`}
    >
      <Swiper
        slidesPerView="auto"
        pagination={{
          clickable: true,
        }}
        className="mt-2 w-full !px-3 sm:!px-5 lg:!px-8 2xl:!px-12"
      >
        {categories.map((item: Category) => (
          <SwiperSlide className="max-w-fit" key={item.label}>
            <CategoryBox
              label={item.label}
              icon={item.icon}
              selected={category === item.label}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default Categories;
