import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { guideContent } from "@/content/guide";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/guide">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const g = guideContent[locale];
  return { title: `${g.title} · Satu`, description: g.intro };
}

// 판매 가이드: 진행 순서, 비용, 준비물, 가격 높이는 팁
export default async function GuidePage({ params }: PageProps<"/[locale]/guide">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const g = guideContent[locale];

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-2 pt-2">
        <h1 className="text-title font-bold text-navy">{g.title}</h1>
        <p className="text-body text-ink/70">{g.intro}</p>
      </div>

      <ol className="flex flex-col gap-3">
        {g.steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-xl bg-white p-4 shadow-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-steppe font-bold text-white">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-subtitle font-semibold">{step.title}</h2>
              <p className="text-body text-ink/80">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {g.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-subtitle font-semibold">{section.heading}</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-ink/80">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <Link href="/sell/new" className="flex h-14 items-center justify-center rounded-xl bg-navy text-subtitle font-bold text-white">
        {g.cta}
      </Link>
    </div>
  );
}
