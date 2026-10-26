import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { POPULAR_MAKES } from "@/lib/car-catalog";
import { almatyYear } from "@/lib/time";
import { PriceLookup } from "./price-lookup";

export async function generateMetadata({ params }: PageProps<"/[locale]/price">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "priceLookup" });
  return { title: `${t("title")} · Satu`, description: t("intro") };
}

// 무료 시세 조회 (로그인 불필요)
export default async function PricePage({ params, searchParams }: PageProps<"/[locale]/price">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("priceLookup");
  // 알림·로그인에서 돌아오면 ?make=&model=&year= 로 바로 조회한다
  const query = await searchParams;
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 40) : "");
  const initial = { make: text(query.make), model: text(query.model), year: /^\d{4}$/.test(text(query.year)) ? text(query.year) : "" };
  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-col gap-1 pt-2">
        <h1 className="text-title font-bold text-navy">{t("title")}</h1>
        <p className="text-body text-ink/70">{t("intro")}</p>
      </div>
      <PriceLookup makes={POPULAR_MAKES} currentYear={almatyYear()} initial={initial} />
    </div>
  );
}
