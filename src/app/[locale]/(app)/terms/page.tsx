import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { legalContent } from "@/content/legal";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return { title: `${legalContent[locale].terms.title} · Garajym` };
}

export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const content = legalContent[locale];
  return <LegalPage doc={content.terms} draftNotice={content.draftNotice} />;
}
