import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { localizedTitle, parseTranslations } from "@/utils/listingText";

import { KkiapayPayment } from "./_components/KkiapayPayment";
import { PaymentShell } from "./_components/PaymentShell";
import {
  getKkiapayPublicKey,
  hasKkiapayVerificationKeys,
  isKkiapaySandbox,
} from "@/lib/kkiapay";
import { isAllowedRedirect } from "@/lib/redirects";
import { createAdminClient } from "@/lib/supabase/admin";
import { localizePath } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("payment");
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: { bookingId: string };
  searchParams?: {
    success?: string | string[];
    cancel?: string | string[];
  };
};

type BookingRow = {
  id: string;
  guest_id: string;
  total_price: number;
  status: string;
  check_in: string;
  check_out: string;
  night_count: number;
  listings:
    | {
        title: string;
        translations: unknown;
        region: string | null;
        country: string | null;
        currency: string;
      }
    | {
        title: string;
        translations: unknown;
        region: string | null;
        country: string | null;
        currency: string;
      }[]
    | null;
};

export default async function KkiapayPaymentPage({
  params,
  searchParams,
}: PageProps) {
  const t = await getTranslations("payment");
  const locale = await getLocale();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, guest_id, total_price, status, check_in, check_out, night_count, listings(title, translations, region, country, currency)"
    )
    .eq("id", params.bookingId)
    .maybeSingle();

  if (error || !data) notFound();

  const booking = data as unknown as BookingRow;
  const listing = Array.isArray(booking.listings)
    ? booking.listings[0]
    : booking.listings;

  if (!listing) notFound();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", booking.guest_id)
    .maybeSingle();

  const requestHeaders = headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") || "http";
  const requestOrigin = host ? `${proto}://${host}` : undefined;

  const successParam =
    typeof searchParams?.success === "string" ? searchParams.success : undefined;
  const cancelParam =
    typeof searchParams?.cancel === "string" ? searchParams.cancel : undefined;

  const successUrl = isAllowedRedirect(successParam, requestOrigin)
    ? successParam
    : `${requestOrigin ?? ""}${localizePath("/trips", locale)}`;
  const cancelUrl = isAllowedRedirect(cancelParam, requestOrigin)
    ? cancelParam
    : `${requestOrigin ?? ""}${localizePath("/annonces", locale)}`;

  if (booking.status !== "pending_payment") {
    const isConfirmed = booking.status === "confirmed";
    const isCancelled =
      booking.status === "cancelled_by_guest" ||
      booking.status === "cancelled_by_host";

    return (
      <PaymentShell>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">
          {t("bookingKicker")}
        </p>
        <h1 className="mt-2 text-xl font-black leading-tight text-neutral-950">
          {isConfirmed
            ? t("alreadyConfirmed")
            : isCancelled
              ? t("cancelled")
              : t("noLongerPending")}
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
          {isConfirmed ? t("alreadyConfirmedText") : t("releasedText")}
        </p>
        <a
          href={isConfirmed ? successUrl : cancelUrl}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-rose-500 text-sm font-bold text-white transition hover:bg-rose-600"
        >
          {isConfirmed ? t("seeTrips") : t("backToListing")}
        </a>
      </PaymentShell>
    );
  }

  if (listing.currency.toUpperCase() !== "XOF") {
    return (
      <PaymentShell>
        <h1 className="text-xl font-black leading-tight text-neutral-950">
          {t("unavailableTitle")}
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
          {t("unavailableText")}
        </p>
        <a
          href={cancelUrl}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
        >
          {t("backToListing")}
        </a>
      </PaymentShell>
    );
  }

  const publicKey = getKkiapayPublicKey();
  const sandbox = isKkiapaySandbox();

  /*
   * En production, encaisser sans pouvoir verifier la transaction laisserait le
   * client debite et la reservation en attente. Le widget n'est donc ouvert en
   * mode reel que si les cles de verification sont presentes. En sandbox, la
   * cle publique suffit pour tester le parcours.
   */
  if (!publicKey || (!sandbox && !hasKkiapayVerificationKeys())) {
    return (
      <PaymentShell>
        <h1 className="text-xl font-black leading-tight text-neutral-950">
          {t("notConfiguredTitle")}
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
          {t("notConfiguredText")}
        </p>
        <a
          href={cancelUrl}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
        >
          {t("backToListing")}
        </a>
      </PaymentShell>
    );
  }

  return (
    <PaymentShell>
      <KkiapayPayment
        bookingId={booking.id}
        amount={booking.total_price}
        publicKey={publicKey}
        sandbox={sandbox}
        sandboxUnverified={sandbox && !hasKkiapayVerificationKeys()}
        successUrl={successUrl}
        cancelUrl={cancelUrl}
        listingTitle={localizedTitle(
          listing.title,
          parseTranslations(listing.translations),
          locale
        )}
        checkIn={booking.check_in}
        checkOut={booking.check_out}
        nightCount={booking.night_count}
        customer={{
          name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          phone: profile?.phone ?? null,
        }}
      />
    </PaymentShell>
  );
}
