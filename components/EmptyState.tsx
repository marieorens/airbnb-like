import React from "react";
import Heading from "./Heading";
import Link from "next/link";

interface EmptyProps {
  title?: string;
  subtitle?: string;
  showReset?: boolean;
}

const EmptyState: React.FC<EmptyProps> = ({
  title = "Aucun resultat exact",
  subtitle = "Essayez de modifier ou de retirer certains filtres.",
  showReset,
}) => {
  return (
    <div className=" h-[60vh] flex flex-col gap-2 justify-center items-center">
      <Heading center title={title} subtitle={subtitle} />
      <div className="w-48 mt-4">
        {showReset && (
          <Link
            href="/"
            className="bg-white border-[1px] border-gray-500 text-[#4e4e4e] rounded hover:opacity-80 transition "
          >
            Retirer tous les filtres
          </Link>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
