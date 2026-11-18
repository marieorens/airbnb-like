import { useTranslations } from "next-intl";
import { MdArrowForward, MdTravelExplore } from "react-icons/md";

import ListingCard from "@/components/ListingCard";
import type { Listing } from "@/types/listing";
import type { RelaxationStepId } from "@/services/listing";
import { Link } from "@/i18n/navigation";

interface AlternativeResultsProps {
  listings: Listing[];
  removedKeys: readonly RelaxationStepId[];
  href: string;
  favorites: string[];
}

// Affiché quand la recherche exacte est vide : des annonces proches, et ce qui a été élargi pour les trouver.
const AlternativeResults = ({
  listings,
  removedKeys,
  href,
  favorites,
}: AlternativeResultsProps) => {
  const t = useTranslations("catalogue.alternatives");
  return (
  <div>
    <div className="mb-7 rounded-[24px] border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#E11D48]">
          <MdTravelExplore size={22} />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-black text-neutral-950">
            {t("title")}
          </h3>
          <p className="mt-1 text-sm font-medium leading-6 text-neutral-500">
            {t("text")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {removedKeys.map((key) => (
              <span
                key={key}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-600"
              >
                {t(`relaxed.${key}`)}
              </span>
            ))}
          </div>
          <Link
            href={href}
            className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#E11D48] transition hover:text-[#BE123C]"
          >
            {t("seeAll")}
            <MdArrowForward size={18} />
          </Link>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-[repeat(auto-fit,minmax(245px,1fr))] gap-6 2xl:gap-7">
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          data={listing}
          hasFavorited={favorites.includes(listing.id)}
        />
      ))}
    </div>
  </div>
  );
};

export default AlternativeResults;
