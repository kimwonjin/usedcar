import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { AdminOnly } from "@/components/admin-only";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { dealerFee, loadFeeBands } from "@/lib/fees";
import { formatTenge } from "@/lib/format";
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
  const feeBands = await loadFeeBands(supabase);
  const startOfDay = startOfAlmatyDay();

  const count = async (table: string, column: string, value: string) => {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    return count ?? 0;
  };

  const [today, live, ended, accepted, pendingDealers, pendingClaims, openReports, { data: dealRows }] = await Promise.all([
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
    count("reports", "status", "open"),
    supabase.from("deals").select("agreed_price, final_price, completed_at").eq("status", "completed"),
  ]);

  // 월별 완료 거래: 건수, 거래액, 딜러 수수료(임시 구간표), 평균가 — 알마티 기준 월
  const months = new Map<string, { count: number; gmv: number; fees: number }>();
  for (const d of (dealRows ?? []) as { agreed_price: number; final_price: number | null; completed_at: string }[]) {
    const price = d.final_price ?? d.agreed_price;
    const key = new Date(new Date(d.completed_at).getTime() + 5 * 3600_000).toISOString().slice(0, 7);
    const m = months.get(key) ?? { count: 0, gmv: 0, fees: 0 };
    m.count += 1;
    m.gmv += price;
    m.fees += dealerFee(price, feeBands);
    months.set(key, m);
  }
  const monthly = [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);

  // 숫자를 누르면 해당 상태로 걸러진 목록으로 이동한다
  const cards = [
    [t("today"), today, "/admin/auctions"],
    [t("live"), live, "/admin/auctions?status=live"],
    [t("ended"), ended, "/admin/auctions?status=ended"],
    [t("accepted"), accepted, "/admin/auctions?status=accepted"],
    [t("pendingDealers"), pendingDealers, "/admin/dealers?status=pending"],
    [t("pendingClaims"), pendingClaims, "/admin/claims?status=submitted"],
    [t("openReports"), openReports, "/admin/reports?status=open"],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-steppe">
            <p className="text-caption text-ink/60">{label}</p>
            <p className="price text-title font-bold">{value}</p>
          </Link>
        ))}
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-subtitle font-semibold">{t("monthlyTitle")}</h2>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-caption">
            <thead className="border-b border-ink/10 text-ink/60">
              <tr>
                <th className="p-3">{t("month")}</th>
                <th className="p-3 text-right">{t("completedDeals")}</th>
                <th className="p-3 text-right">{t("gmv")}</th>
                <th className="p-3 text-right">{t("avgPrice")}</th>
                <th className="p-3 text-right">{t("fees")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {monthly.map(([month, m]) => (
                <tr key={month}>
                  <td className="p-3 font-semibold">{month}</td>
                  <td className="price p-3 text-right">{m.count}</td>
                  <td className="price p-3 text-right">{formatTenge(m.gmv)}</td>
                  <td className="price p-3 text-right">{formatTenge(m.gmv / m.count)}</td>
                  <td className="price p-3 text-right">{formatTenge(m.fees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {monthly.length === 0 && <p className="p-6 text-center text-ink/60">{t("emptyList")}</p>}
        </div>
        <p className="text-caption text-ink/50">{t("feesNote")}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-subtitle font-semibold">{t("exportTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {(["deals", "payments", "users"] as const).map((type) => (
            // 파일 내려받기라 Link 대신 일반 a 태그
            <a
              key={type}
              href={`/api/admin/export?type=${type}`}
              download
              className="rounded-lg border border-navy px-4 py-2 text-body font-semibold text-navy"
            >
              ⬇ {t(`export.${type}`)}
            </a>
          ))}
        </div>
        <p className="text-caption text-ink/50">{t("exportNote")}</p>
      </section>
    </div>
  );
}