import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { legalContent } from "@/content/legal";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: `${t("faq")} · Satu` };
}

// 자주 묻는 질문: 질문을 누르면 답이 펼쳐진다
export default async function FaqPage({ params }: PageProps<"/[locale]/faq">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const faq = legalContent[locale].faq;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <h1 className="text-title font-bold text-navy">{t("faq")}</h1>
      {faq.map((group) => (
        <section key={group.group} className="flex flex-col gap-2">
          <h2 className="text-subtitle font-semibold">{group.group}</h2>
          <div className="divide-y divide-ink/10 overflow-hidden rounded-xl bg-white shadow-sm">
            {group.items.map((item) => (
              <details key={item.q} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-body font-semibold">
                  {item.q}
                  <span className="shrink-0 text-ink/40 transition group-open:rotate-180">⌄</span>
                </summary>
                <p className="mt-2 text-body leading-relaxed text-ink/80">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="text-caption text-ink/60">{t("moreHelp")}</p>
    </div>
  );
}
