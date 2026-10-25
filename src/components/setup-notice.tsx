import { useTranslations } from "next-intl";

export function SetupNotice() {
  const t = useTranslations("common");
  return (
    <p className="rounded-lg border border-steppe/30 bg-steppe/5 p-4 text-caption">
      {t("setupRequired")}
    </p>
  );
}
