import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const localeLabels = { ko: "한국어", ru: "Рус", kk: "Қаз" } as const;

export function Header() {
  const t = useTranslations("common");
  const current = useLocale();

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-title font-bold tracking-tight">
          {t("appName")}
        </Link>
        <nav className="flex gap-3 text-caption">
          {routing.locales.map((locale) => (
            <Link
              key={locale}
              href="/"
              locale={locale}
              className={locale === current ? "text-steppe" : "text-white/70"}
            >
              {localeLabels[locale]}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
