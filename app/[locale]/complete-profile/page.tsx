import { getTranslations } from "next-intl/server";
import EmptyState from "@/components/EmptyState";
import { getCurrentUser } from "@/services/user";
import CompleteProfileForm from "./_components/CompleteProfileForm";

type CompleteProfilePageProps = {
  searchParams?: {
    next?: string;
  };
};

export default async function CompleteProfilePage({
  searchParams,
}: CompleteProfilePageProps) {
  const t = await getTranslations("profile");
  const user = await getCurrentUser();

  if (!user) {
    return (
      <EmptyState
        title={t("signInRequired")}
        subtitle={t("signInPrompt")}
      />
    );
  }

  const next = searchParams?.next ?? "/";

  return (
    <section className="main-container max-w-5xl">
      <div className="grid gap-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:grid-cols-[0.85fr_1.15fr] md:p-8">
        <aside className="rounded-2xl bg-neutral-950 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-300">
            {t("kicker")}
          </p>
          <h1 className="mt-4 text-3xl font-black leading-tight">
            {t("title")}
          </h1>
          <p className="mt-4 text-sm leading-6 text-neutral-300">
            {t("intro")}
          </p>
          <div className="mt-8 grid gap-3 text-sm text-neutral-200">
            <span className="rounded-lg bg-white/10 p-3">
              {t("point1")}
            </span>
            <span className="rounded-lg bg-white/10 p-3">
              {t("point2")}
            </span>
            <span className="rounded-lg bg-white/10 p-3">
              {t("point3")}
            </span>
          </div>
        </aside>

        <CompleteProfileForm user={user} next={next} />
      </div>
    </section>
  );
}
