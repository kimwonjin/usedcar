import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { AdminOnly } from "@/components/admin-only";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { startOfAlmatyDay } from "@/lib/time";

// A1 관리자 대시보드 (PC 웹, 표 중심)
export default async function AdminDashboard({ params }: PageProps<"/[locale]/admin">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  if (!isSupabaseConfigured) return <SetupNotice />;

  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const supabase = await createClient();
  const startOfDay = startOfAlmatyDay();

  const count = async (table: string, column: string, value: string) => {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    return count ?? 0;
  };

  const [today, live, ended, accepted, pendingDealers, pendingClaims] = await Promise.all([
    supabase
      .from("auctions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString())
      .then(({ count }) => count ?? 0),
    count("auctions", "status", "live"),
    count("auctions", "status", "ended"),
    count("auctions", "status", "accepted"),
    count("dealers", "status", "pending"),
    count("depreciation_claims", "status", "submitted"),
  ]);

  const cards = [
    [t("today"), today],
    [t("live"), live],
    [t("ended"), ended],
    [t("accepted"), accepted],
    [t("pendingDealers"), pendingDealers],
    [t("pendingClaims"), pendingClaims],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm">
            <dt className="text-caption text-ink/60">{label}</dt>
            <dd className="price text-title font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
