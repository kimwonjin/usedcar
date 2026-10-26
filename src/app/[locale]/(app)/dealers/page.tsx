import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { dealerIntroContent } from "@/content/dealer-intro";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { DEFAULT_FEE_BANDS, type FeeBand } from "@/lib/fees";
import { formatTenge } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

// 수수료 구간표는 관리자 설정을 따른다 (5분마다 갱신)
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/dealers">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const c = dealerIntroContent[locale];
  return { title: `${c.title} · Garajym`, description: c.intro };
}

// 딜러 모집: 장점, 가입 절차, 조건, 규칙, 수수료표
export default async function DealersPage({ params }: PageProps<"/[locale]/dealers">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const c = dealerIntroContent[locale];

  const supabase = createPublicClient();
  const [{ data }, { data: feeSetting }] = supabase
    ? await Promise.all([
        supabase.from("fee_bands").select("max_price, fee").order("max_price", { nullsFirst: false }),
        supabase.from("app_settings").select("value").eq("key", "fees_enabled").maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const freePilot = feeSetting?.value === "off";
  const bands = (data?.length ? data : DEFAULT_FEE_BANDS) as FeeBand[];

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-2 pt-2">
        <h1 className="text-title font-bold text-navy">{c.title}</h1>
        <p className="text-body text-ink/70">{c.intro}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {c.benefits.map((b) => (
          <div key={b.title} className="flex flex-col gap-1 rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-subtitle font-semibold">✓ {b.title}</h2>
            <p className="text-body text-ink/80">{b.body}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-subtitle font-semibold">{c.feeTitle}</h2>
        {freePilot && (
          <p className="rounded-lg bg-steppe/10 p-3 text-body font-semibold text-steppe">🎁 {c.freePilot}</p>
        )}
        <table className="w-full text-body">
          <tbody className="divide-y divide-ink/10">
            {bands.map((band) => (
              <tr key={band.max_price ?? "max"}>
                <td className="py-2 text-ink/70">
                  {band.max_price ? c.upTo.replace("{price}", formatTenge(band.max_price)) : c.above}
                </td>
                <td className="price py-2 text-right font-semibold">{formatTenge(band.fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-caption text-ink/50">{c.feeNote}</p>
      </section>

      <section className="flex flex-col gap-2">
        <ol className="flex flex-col gap-2">
          {c.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-steppe text-caption font-bold text-white">
                {i + 1}
              </span>
              <span className="text-body">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {[c.requirements, c.rules].map((list, i) => (
        <ul key={i} className="flex list-disc flex-col gap-1 rounded-xl bg-white p-4 pl-9 text-body text-ink/80 shadow-sm">
          {list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ))}

      <Link
        href="/login?next=/dealer"
        className="flex h-14 items-center justify-center rounded-xl bg-navy text-subtitle font-bold text-white"
      >
        {c.cta}
      </Link>
    </div>
  );
}
