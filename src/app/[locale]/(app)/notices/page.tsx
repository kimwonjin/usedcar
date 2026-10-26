import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localized, type Announcement } from "@/lib/announcements";
import { formatDate } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/notices">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "notices" });
  return { title: `${t("title")} · Satu` };
}

// 공지사항 목록 (로그인 불필요). 게시 기간 안의 공지만 RLS로 읽힌다
export default async function NoticesPage({ params }: PageProps<"/[locale]/notices">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("notices");

  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, audience, title, body, link, pinned, starts_at, ends_at, created_at")
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(50);
  const notices = (data ?? []) as Announcement[];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      {notices.length === 0 && <p className="py-8 text-center text-ink/60">{t("empty")}</p>}
      <ul className="flex flex-col gap-3">
        {notices.map((n) => (
          <li key={n.id} id={n.id} className="flex scroll-mt-4 flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-caption text-ink/60">
              <span>
                {n.pinned && "📌 "}
                {n.audience !== "all" && `${t(`audience.${n.audience}`)} · `}
                {formatDate(n.starts_at, locale)}
              </span>
            </div>
            <h2 className="text-subtitle font-semibold">{localized(n.title, locale)}</h2>
            {localized(n.body, locale) && <p className="text-body whitespace-pre-line text-ink/80">{localized(n.body, locale)}</p>}
            {n.link && (
              <Link href={n.link} className="text-body font-semibold text-steppe">
                {t("more")} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
