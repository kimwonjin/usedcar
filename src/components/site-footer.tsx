import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("legal");
  return (
    <footer className="border-t border-ink/10 bg-white print:hidden">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-caption text-ink/60">
        <span className="font-semibold text-navy">Satu</span>
        <Link href="/terms">{t("terms")}</Link>
        <Link href="/privacy" className="font-semibold">
          {t("privacy")}
        </Link>
        <Link href="/faq">{t("faq")}</Link>
      </div>
    </footer>
  );
}
