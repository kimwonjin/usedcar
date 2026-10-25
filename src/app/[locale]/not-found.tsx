import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-[48px]">🚗💨</p>
      <h1 className="text-title font-bold text-navy">{t("notFoundTitle")}</h1>
      <p className="text-body text-ink/60">{t("notFoundBody")}</p>
      <Link href="/" className="mt-2 rounded-xl bg-navy px-5 py-3 font-semibold text-white">
        {t("home")}
      </Link>
    </div>
  );
}
