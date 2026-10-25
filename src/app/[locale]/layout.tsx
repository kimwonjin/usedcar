import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { routing } from "@/i18n/routing";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

export const metadata: Metadata = {
  title: "Satu — 알마티 내 차 팔기 경매",
  description: "승인된 알마티 딜러들의 48시간 경쟁 입찰로 내 차를 최고가에 파세요.",
  appleWebApp: { capable: true, title: "Satu", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

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
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Header />
          {/* 관리자 화면(.admin-wide)은 PC용으로 넓게 */}
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 has-[.admin-wide]:max-w-6xl">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
