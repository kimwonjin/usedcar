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
        <Link href="/" className="shrink-0 text-subtitle font-bold tracking-tight sm:text-title">
          {t("appName")}
        </Link>
        <div className="flex items-center gap-2.5">
          <HeaderMenu />
          <nav className="hidden gap-1.5 border-l border-white/20 pl-2.5 text-caption whitespace-nowrap sm:flex">
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
          {/* 좁은 화면: 이름이 긴 러시아어·카자흐어 메뉴가 넘치지 않게 언어는 펼침 메뉴로 */}
          <details className="relative border-l border-white/20 pl-2.5 text-caption sm:hidden">
            <summary className="cursor-pointer list-none text-steppe [&::-webkit-details-marker]:hidden">
              {localeLabels[current as keyof typeof localeLabels]} ▾
            </summary>
            <div className="absolute top-full right-0 z-50 mt-3 flex flex-col overflow-hidden rounded-lg bg-navy shadow-lg">
              {routing.locales.map((locale) => (
                <Link
                  key={locale}
                  href="/"
                  locale={locale}
                  className={`px-4 py-2 ${locale === current ? "text-steppe" : "text-white/80"}`}
                >
                  {localeLabels[locale]}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
