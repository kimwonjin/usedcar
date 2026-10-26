import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { StatusBadge } from "@/components/status-badge";
import { Stars } from "@/components/stars";
import { Link } from "@/i18n/navigation";
import { requireAdmin, type DealerProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { DealerActions } from "./dealer-actions";
import { PenaltyList, type PenaltyRow } from "./penalty-list";

const STATUSES = ["pending", "approved", "rejected", "suspended"] as const;

type DealerRow = DealerProfile & { created_at: string; profiles: { phone: string | null } | null };

// A2 딜러 관리: 가입 신청 승인·거절, 경고·입찰 정지
export default async function AdminDealers({ params, searchParams }: PageProps<"/[locale]/admin/dealers">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const ts = await getTranslations("status");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const status = STATUSES.find((s) => s === query.status) ?? "pending";

  const supabase = await createClient();
  const { data } = await supabase
    .from("dealers")
    .select("id, business_name, bin, address, shop_photo_paths, status, rejection_reason, rating, warning_count, bid_blocked_until, created_at, profiles!dealers_id_fkey(phone)")
    .eq("status", status)
    .order("created_at", { ascending: status !== "pending" ? false : true })
    .overrideTypes<DealerRow[], { merge: false }>();
  const dealers = data ?? [];
  const [photoUrls, { data: penaltyData }] = await Promise.all([
    signedUrlMap(supabase, "dealer-docs", dealers.flatMap((d) => d.shop_photo_paths)),
    dealers.length
      ? supabase
          .from("dealer_penalties")
          .select("id, dealer_id, reason, action, note, created_at, revoked_at, revoke_note")
          .in("dealer_id", dealers.map((d) => d.id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const penalties = (penaltyData ?? []) as (PenaltyRow & { dealer_id: string })[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("dealersTitle")}</h1>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/dealers?status=${s}`}
            className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
              s === status ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"
            }`}
          >
            {ts(`dealer.${s}`)}
          </Link>
        ))}
      </div>

      {dealers.length === 0 && <p className="py-8 text-center text-ink/60">{t("emptyList")}</p>}
      <div className="flex flex-col gap-3">
        {dealers.map((dealer) => (
          <article key={dealer.id} className="grid gap-4 rounded-xl bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-subtitle font-semibold">{dealer.business_name}</h2>
                <StatusBadge kind="dealer" status={dealer.status} />
                {dealer.status === "approved" && <Stars rating={dealer.rating} />}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-caption">
                <dt className="text-ink/60">{t("bin")}</dt>
                <dd className="price">{dealer.bin}</dd>
                <dt className="text-ink/60">{t("phone")}</dt>
                <dd className="price">{dealer.profiles?.phone ?? "—"}</dd>
                <dt className="text-ink/60">{t("address")}</dt>
                <dd>{dealer.address}</dd>
                <dt className="text-ink/60">{t("appliedAt")}</dt>
                <dd>{formatDateTime(dealer.created_at, locale)}</dd>
                <dt className="text-ink/60">{t("warnings")}</dt>
                <dd className={dealer.warning_count ? "font-semibold text-danger" : ""}>{dealer.warning_count}</dd>
                {dealer.bid_blocked_until && new Date(dealer.bid_blocked_until) > new Date() && (
                  <>
                    <dt className="text-ink/60">{t("blockedUntil")}</dt>
                    <dd className="font-semibold text-danger">{formatDateTime(dealer.bid_blocked_until, locale)}</dd>
                  </>
                )}
                {dealer.rejection_reason && (
                  <>
                    <dt className="text-ink/60">{t("rejectionReason")}</dt>
                    <dd>{dealer.rejection_reason}</dd>
                  </>
                )}
              </dl>
              <div className="flex gap-2">
                {dealer.shop_photo_paths.map((path) =>
                  photoUrls[path] ? (
                    <a key={path} href={photoUrls[path]} target="_blank" rel="noreferrer" className="h-24 w-32 overflow-hidden rounded-lg bg-ink/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrls[path]} alt="" className="size-full object-cover" />
                    </a>
                  ) : null,
                )}
              </div>
            </div>
            <DealerActions dealerId={dealer.id} status={dealer.status} />
            <div className="md:col-span-2">
              <PenaltyList penalties={penalties.filter((p) => p.dealer_id === dealer.id)} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
