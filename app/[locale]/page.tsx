import { useTranslations } from "next-intl";
import {
  FaBuildingCircleCheck,
  FaHouseChimney,
  FaLocationDot,
} from "react-icons/fa6";
import {
  MdArrowForward,
  MdOutlineVerifiedUser,
  MdTravelExplore,
} from "react-icons/md";
import { RiHomeHeartLine, RiMapPinRangeLine, RiUserStarLine } from "react-icons/ri";
import RevealOnScroll from "@/components/RevealOnScroll";
import { Link } from "@/i18n/navigation";

const heroImage =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85";

// Textes : `home.features.<key>` dans messages/*.json.
const featureCards = [
  { key: "stays", href: "/annonces?transactionType=booking", icon: MdTravelExplore },
  { key: "rentals", href: "/annonces?transactionType=rent", icon: FaHouseChimney },
  { key: "sales", href: "/annonces?transactionType=sale", icon: FaBuildingCircleCheck },
  {
    key: "plots",
    href: "/annonces?assetType=land_sale&transactionType=sale",
    icon: RiMapPinRangeLine,
  },
] as const;

// Textes : `home.trust.<key>` dans messages/*.json.
const trustItems = [
  { key: "profiles", icon: RiUserStarLine },
  { key: "listings", icon: MdOutlineVerifiedUser },
  { key: "search", icon: RiHomeHeartLine },
];

export default function Home() {
  const t = useTranslations("home");
  return (
    <main className="bg-[#F7F7F4] text-[#111827]">
      <section className="page-container pt-6">
        <div className="relative min-h-[610px] overflow-hidden rounded-[28px] bg-[#111827] text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)] sm:rounded-[36px] lg:min-h-[680px]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07111F]/95 via-[#07111F]/72 to-[#07111F]/18" />

          <div className="relative grid min-h-[610px] content-between gap-10 p-5 sm:p-7 md:p-10 lg:min-h-[680px] xl:p-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
            </div>

            <div className="max-w-4xl xl:max-w-[56vw]">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-[#F43F5E] md:text-sm">
                VacationHub
              </p>
              <h1 className="max-w-5xl text-4xl font-black leading-[1.02] tracking-normal sm:text-5xl md:text-6xl xl:text-7xl">
                {t("heroTitle")}
              </h1>
              <p className="mt-6 max-w-3xl text-sm font-semibold leading-7 text-white/82 md:text-base lg:text-lg">
                {t("heroText")}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/annonces"
                  className="inline-flex h-12 items-center gap-3 rounded-full bg-[#F43F5E] px-5 text-sm font-black text-white shadow-[0_18px_40px_rgba(244,63,94,0.34)] transition hover:bg-[#E11D48] md:h-14 md:px-7"
                >
                  {t("exploreListings")}
                  <MdArrowForward size={20} />
                </Link>
                <Link
                  href="/annonces?assetType=land_sale&transactionType=sale"
                  className="inline-flex h-12 items-center rounded-full border border-white/30 bg-white/10 px-5 text-sm font-black text-white backdrop-blur transition hover:bg-white hover:text-[#111827] md:h-14 md:px-7"
                >
                  {t("seePlots")}
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:max-w-[72vw]">
              {trustItems.map((item) => {
                const Icon = item.icon;
                return (
                  <RevealOnScroll
                    key={item.key}
                    className="h-full"
                    delay={trustItems.indexOf(item) * 90}
                  >
                    <div className="h-full rounded-[22px] border border-white/16 bg-white/12 p-4 backdrop-blur-md md:p-5">
                      <Icon className="text-[#FDA4AF]" size={22} />
                      <h2 className="mt-4 text-sm font-black md:text-base">
                        {t(`trust.${item.key}.title`)}
                      </h2>
                      <p className="mt-2 text-xs font-medium leading-5 text-white/72 md:text-sm md:leading-6">
                        {t(`trust.${item.key}.text`)}
                      </p>
                    </div>
                  </RevealOnScroll>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="presentation"
        className="page-container py-14 lg:py-16"
      >
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E11D48]">
              {t("presentationKicker")}
            </p>
            <h2 className="mt-4 text-3xl font-black leading-tight md:text-4xl xl:text-5xl">
              {t("presentationTitle")}
            </h2>
            <p className="mt-5 text-base font-medium leading-8 text-neutral-600">
              {t("presentationText")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <RevealOnScroll
                  key={card.key}
                  className="h-full"
                  delay={featureCards.indexOf(card) * 100}
                >
                  <Link
                    href={card.href}
                    className="group block h-full rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)] md:p-6"
                  >
                    <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#111827] text-white">
                      <Icon size={24} />
                    </span>
                    <h3 className="mt-7 text-xl font-black md:text-2xl">
                      {t(`features.${card.key}.title`)}
                    </h3>
                    <p className="mt-3 text-sm font-medium leading-6 text-neutral-600">
                      {t(`features.${card.key}.text`)}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#E11D48]">
                      {t("discover")}
                      <MdArrowForward
                        className="transition group-hover:translate-x-1"
                        size={18}
                      />
                    </span>
                  </Link>
                </RevealOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      <section className="page-container pb-16">
        <RevealOnScroll>
          <div className="overflow-hidden rounded-[28px] bg-[#111827] text-white sm:rounded-[34px]">
            <div className="grid gap-8 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FDA4AF]">
                  {t("ctaKicker")}
                </p>
                <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight md:text-4xl xl:text-5xl">
                  {t("ctaTitle")}
                </h2>
                <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-white/70">
                  {t("ctaText")}
                </p>
              </div>
              <Link
                href="/annonces"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-white px-7 text-sm font-black text-[#111827] transition hover:bg-neutral-200"
              >
                {t("ctaButton")}
                <MdArrowForward size={20} />
              </Link>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </main>
  );
}
