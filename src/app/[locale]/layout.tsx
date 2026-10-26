import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { ReferralCapture } from "@/components/referral";
import { Header } from "@/components/header";
import { SiteFooter } from "@/components/site-footer";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/integrations/config";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

const OG_LOCALES = { ko: "ko_KR", ru: "ru_RU", kk: "kk_KZ" } as const;

// 언어별 제목·설명. 메신저(WhatsApp·Telegram)로 링크를 공유하면 이 내용과 opengraph-image 가 보인다
export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl),
    title: t("title"),
    description: t("description"),
    openGraph: {
      type: "website",
      siteName: "Garajym",
      title: t("title"),
      description: t("description"),
      locale: OG_LOCALES[locale],
    },
    appleWebApp: { capable: true, title: "Garajym", statusBarStyle: "default" },
    other: { google: "notranslate" },
    icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#14213D",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    // 3개 언어를 직접 제공하므로 브라우저 자동 번역을 막는다 (기계 번역 오역 + 번역기가 화면 구조를 바꿔 React 오류가 나는 문제)
    <html lang={locale} translate="no" className={`${inter.variable} notranslate h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Header />
          <AnnouncementBanner />
          <ReferralCapture />
          {/* 관리자 화면(.admin-wide)은 PC용으로 넓게 */}
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 has-[.admin-wide]:max-w-6xl print:max-w-none print:p-0">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
