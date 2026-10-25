import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { HeaderMenu } from "./header-menu";

const localeLabels = { ko: "KO", ru: "RU", kk: "KZ" } as const;

export function Header() {
  const t = useTranslations("common");
  const current = useLocale();

  return (
    <header className="bg-navy text-white print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link href="/" className="text-subtitle font-bold tracking-tight sm:text-title">
          {t("appName")}
        </Link>
        <div className="flex items-center gap-2.5">
          <HeaderMenu />
          <nav className="flex gap-1.5 border-l border-white/20 pl-2.5 text-caption whitespace-nowrap">
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
