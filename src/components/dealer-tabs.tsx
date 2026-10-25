import { useTranslations } from "next-intl";
import { TabsNav } from "./tabs-nav";

export function DealerTabs() {
  const t = useTranslations("dealer");
  return (
    <TabsNav
      tabs={[
        { href: "/dealer", label: t("tabAuctions"), exact: true },
        { href: "/dealer/activity", label: t("tabActivity") },
        { href: "/dealer/billing", label: t("tabBilling") },
      ]}
    />
  );
}
