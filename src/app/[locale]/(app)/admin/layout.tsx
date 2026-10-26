import { getTranslations } from "next-intl/server";
import { TabsNav } from "@/components/tabs-nav";
import { getCurrentUser } from "@/lib/auth";

// 관리자 웹 공통 탭 (A1~A4)
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const t = await getTranslations("admin");
  // 관리자가 아니면 탭(관리 메뉴 이름)도 보여주지 않는다. 로그인·권한 안내는 각 페이지가 한다
  if ((await getCurrentUser())?.role !== "admin") return children;
  return (
    <div className="admin-wide flex flex-col gap-4">
      <TabsNav
        tabs={[
          { href: "/admin", label: t("tabDashboard"), exact: true },
          { href: "/admin/review", label: t("tabReview") },
          { href: "/admin/insights", label: t("tabInsights") },
          { href: "/admin/dealers", label: t("tabDealers") },
          { href: "/admin/auctions", label: t("tabAuctions") },
          { href: "/admin/claims", label: t("tabClaims") },
          { href: "/admin/transfers", label: t("tabTransfers") },
          { href: "/admin/reports", label: t("tabReports") },
          { href: "/admin/support", label: t("tabSupport") },
          { href: "/admin/payments", label: t("tabPayments") },
          { href: "/admin/users", label: t("tabUsers") },
          { href: "/admin/referrals", label: t("tabReferrals") },
          { href: "/admin/notices", label: t("tabNotices") },
          { href: "/admin/settings", label: t("tabSettings") },
        ]}
      />
      {children}
    </div>
  );
}
