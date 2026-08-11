'use client'
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import queryString from "query-string";

import { Category } from "@/types";

interface CategoryBoxProps extends Category {
  selected?: boolean;
}

const CategoryBox: React.FC<CategoryBoxProps> = ({
  icon: Icon,
  label,
  selected,
}) => {
  const router = useRouter();
  const params = useSearchParams();

  const handleClick = () => {
    let currentQuery = {};
    if (params) {
      currentQuery = queryString.parse(params.toString());
    }

    const updatedQuery: any = {
      ...currentQuery,
      category: label,
    };

    if (params?.get("category") === label) {
      delete updatedQuery.category;
    }

    const url = queryString.stringifyUrl(
      {
        url: "/annonces",
        query: updatedQuery,
      },
      { skipNull: true }
    );
    router.push(url);
  }
  
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex min-w-[72px] max-w-fit flex-col items-center justify-center gap-2 border-b-2 px-2 pb-3 pt-2 text-[19px] transition hover:text-neutral-800 md:min-w-[86px] md:text-[23px] ${
        selected
          ? "border-b-neutral-800 text-neutral-800 "
          : "border-transparent text-neutral-500"}`}
    >
      <Icon  />
      <small className="select-none text-center text-[12px] font-semibold md:text-[13px]">
        {label}
      </small>
    </button>
  );
};

export default CategoryBox;
