import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/datetime";
import { formatKm, formatTenge } from "@/lib/format";
import { loadPublicSale } from "@/lib/public-sale";

export async function generateMetadata({ params }: PageProps<"/[locale]/sold/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "sold" });
  const sale = await loadPublicSale(id);
  if (!sale) return { title: "Satu", robots: { index: false } };
  const car = `${sale.make} ${sale.model} ${sale.year}`;
  const title = t("title", { car });
  const description = t("shareText", { car, price: formatTenge(sale.price), count: sale.bidders });
  return {
    title: `${title} · Satu`,
    description,
    // 레이아웃의 사이트 소개 대신 이 판매 결과로 미리보기를 채운다 (이미지는 opengraph-image.tsx)
    openGraph: { type: "website", siteName: "Satu", title, description },
    // 개인이 공유한 결과라 검색에는 올리지 않는다 (미리보기는 그대로 보인다)
    robots: { index: false },
  };
}

// 판매 결과 공유 페이지 (로그인 불필요): 받은 사람을 시세 조회·판매 시작으로 안내한다
export default async function SoldPage({ params }: PageProps<"/[locale]/sold/[id]">) {
  const { locale: raw, id } = await params;
  const locale = raw as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const sale = await loadPublicSale(id);
  if (!sale) notFound();
  const t = await getTranslations("sold");
  const car = `${sale.make} ${sale.model}`;
  const priceQuery = { make: sale.make, model: sale.model, year: String(sale.year) };

  return (
    <div className="flex flex-col gap-4 pt-2 pb-6">
      <section className="flex flex-col items-center gap-2 rounded-2xl bg-navy px-5 py-8 text-center text-white">
        <p className="text-caption text-white/70">🎉 {t("badge")}</p>
        <h1 className="text-title font-bold">
          {car} · {sale.year}
        </h1>
        <p className="text-caption text-white/70">
          {formatKm(sale.mileage_km)} · {formatDate(sale.completed_at, locale)}
        </p>
        <p className="price mt-3 text-price font-bold text-gold">{formatTenge(sale.price)}</p>
        <p className="text-body">{t("competed", { count: sale.bidders })}</p>
      </section>

      <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-subtitle font-semibold">{t("howTitle")}</h2>
        <ul className="flex flex-col gap-1.5 text-body text-ink/80">
          <li>✓ {t("how1")}</li>
          <li>✓ {t("how2")}</li>
          <li>✓ {t("how3")}</li>
        </ul>
      </section>

      <Link
        href={{ pathname: "/price", query: priceQuery }}
        className="flex h-14 items-center justify-center rounded-xl bg-steppe text-subtitle font-bold text-white"
      >
        {t("ctaPrice")}
      </Link>
      <Link
        href="/sell/new"
        className="flex h-14 items-center justify-center rounded-xl border-2 border-navy text-subtitle font-bold text-navy"
      >
        {t("ctaSell")}
      </Link>
    </div>
  );
}
