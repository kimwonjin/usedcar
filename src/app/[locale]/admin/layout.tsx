import { getTranslations } from "next-intl/server";
import { TabsNav } from "@/components/tabs-nav";

// 관리자 웹 공통 탭 (A1~A4)
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const t = await getTranslations("admin");
  return (
    <div className="admin-wide flex flex-col gap-4">
      <TabsNav
        tabs={[
          { href: "/admin", label: t("tabDashboard"), exact: true },
          { href: "/admin/dealers", label: t("tabDealers") },
          { href: "/admin/auctions", label: t("tabAuctions") },
          { href: "/admin/claims", label: t("tabClaims") },
          { href: "/admin/transfers", label: t("tabTransfers") },
          { href: "/admin/reports", label: t("tabReports") },
          { href: "/admin/support", label: t("tabSupport") },
          { href: "/admin/payments", label: t("tabPayments") },
          { href: "/admin/users", label: t("tabUsers") },
          { href: "/admin/notices", label: t("tabNotices") },
          { href: "/admin/settings", label: t("tabSettings") },
        ]}
      />
      {children}
    </div>
  );
}
