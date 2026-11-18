import React from "react";
import Heading from "./Heading";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

interface EmptyProps {
  title?: string;
  subtitle?: string;
  showReset?: boolean;
}

const EmptyState: React.FC<EmptyProps> = ({
  title,
  subtitle,
  showReset,
}) => {
  const t = useTranslations("emptyState");
  return (
    <div className=" h-[60vh] flex flex-col gap-2 justify-center items-center">
      <Heading center title={title ?? t("title")} subtitle={subtitle ?? t("subtitle")} />
      <div className="w-48 mt-4">
        {showReset && (
          <Link
            href="/"
            className="bg-white border-[1px] border-gray-500 text-[#4e4e4e] rounded hover:opacity-80 transition "
          >
            {t("reset")}
          </Link>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
