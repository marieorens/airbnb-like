import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nunito } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import "../globals.css";
import "react-loading-skeleton/dist/skeleton.css";
import Navbar from "@/components/navbar";
import Providers from "@/components/Provider";
import { isLocale } from "@/i18n/routing";

const nunito = Nunito({ subsets: ["latin"] });

const themeScript = `
  (function() {
    try {
      var savedTheme = window.localStorage.getItem('vacationhub-theme');
      var theme = savedTheme === 'dark' || savedTheme === 'light'
        ? savedTheme
        : 'light';
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = 'light';
    }
  })();
`;

type LayoutParams = { params: { locale: string } };

export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function LocaleLayout({
  children,
  params,
}: LayoutParams & { children: React.ReactNode }) {
  if (!isLocale(params.locale)) notFound();

  return (
    <html lang={params.locale} suppressHydrationWarning>
      <body className={nunito.className}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <NextIntlClientProvider>
          <Providers>
            <Navbar />
            <main className="pb-16 md:pt-28 pt-24">{children}</main>
          </Providers>
        </NextIntlClientProvider>
      </body>
      <GoogleAnalytics gaId={process.env.GA_MEASUREMENT_ID || ""} />
    </html>
  );
}
