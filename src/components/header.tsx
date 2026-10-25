import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { HeaderMenu } from "./header-menu";

const localeLabels = { ko: "한", ru: "Рус", kk: "Қаз" } as const;

export function Header() {
  const t = useTranslations("common");
  const current = useLocale();

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="text-title font-bold tracking-tight">
          {t("appName")}
        </Link>
        <div className="flex items-center gap-4">
          <HeaderMenu />
          <nav className="flex gap-2 border-l border-white/20 pl-3 text-caption">
            {routing.locales.map((locale) => (
              <Link
                key={locale}
                href="/"
                locale={locale}
                className={locale === current ? "text-steppe" : "text-white/60"}
              >
                {localeLabels[locale]}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
