import { useTranslations } from "next-intl";

export function AdminOnly() {
  const t = useTranslations("admin");
  return <p className="rounded-xl bg-white p-6 text-center text-ink/70">{t("adminOnly")}</p>;
}
