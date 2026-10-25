import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CancelAuctionButton } from "./cancel-auction-button";

const FILTERS = ["all", "live", "ended", "accepted", "rejected", "no_bids", "cancelled"] as const;

type AdminAuction = {
  id: string;
  status: string;
  created_at: string;
  ends_at: string;
  cars: { make: string; model: string; year: number; plate_number: string };
  profiles: { phone: string | null } | null;
  bids: { amount: number }[];
};

// A3 경매 관리: 전체 경매, 상태별 필터, 강제 종료
export default async function AdminAuctions({ params, searchParams }: PageProps<"/[locale]/admin/auctions">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const ts = await getTranslations("status");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const filter = FILTERS.find((f) => f === query.status) ?? "all";

  const supabase = await createClient();
  let request = supabase
    .from("auctions")
    .select("id, status, created_at, ends_at, cars(make, model, year, plate_number), profiles(phone), bids!bids_auction_id_fkey(amount)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "all") request = request.eq("status", filter);
  const { data } = await request.overrideTypes<AdminAuction[], { merge: false }>();
  const auctions = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("auctionsTitle")}</h1>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/auctions?status=${f}`}
            className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
              f === filter ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"
            }`}
          >
            {f === "all" ? t("all") : ts(`auction.${f}`)}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-caption">
          <thead className="border-b border-ink/10 text-ink/60">
            <tr>
              <th className="p-3">{t("car")}</th>
              <th className="p-3">{t("seller")}</th>
              <th className="p-3">{t("createdAt")}</th>
              <th className="p-3">{t("endsAt")}</th>
              <th className="p-3 text-right">{t("bidCount")}</th>
              <th className="p-3 text-right">{t("topBid")}</th>
              <th className="p-3">{t("status")}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {auctions.map((a) => {
              const top = a.bids.length ? Math.max(...a.bids.map((b) => b.amount)) : null;
              return (
                <tr key={a.id}>
                  <td className="p-3">
                    <p className="font-semibold">
                      {a.cars.make} {a.cars.model} · {a.cars.year}
                    </p>
                    <p className="price text-ink/50">{a.cars.plate_number}</p>
                  </td>
                  <td className="price p-3">{a.profiles?.phone ?? "—"}</td>
                  <td className="p-3">{formatDateTime(a.created_at, locale)}</td>
                  <td className="p-3">{formatDateTime(a.ends_at, locale)}</td>
                  <td className="price p-3 text-right">{a.bids.length}</td>
                  <td className="price p-3 text-right font-semibold">{top ? formatTenge(top) : "—"}</td>
                  <td className="p-3">
                    <StatusBadge kind="auction" status={a.status} />
                  </td>
                  <td className="p-3">
                    {(a.status === "live" || a.status === "ended") && <CancelAuctionButton auctionId={a.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {auctions.length === 0 && <p className="p-8 text-center text-ink/60">{t("emptyList")}</p>}
      </div>
    </div>
  );
}
